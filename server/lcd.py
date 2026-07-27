"""Drives a 16x2 HD44780 LCD (4-bit mode) so the setup instructions are
visible immediately after boot, before a monitor or SSH session is available.

Wired directly to BCM GPIO (RW tied to GND -- write-only, no read needed):
  RS -> GPIO25   E -> GPIO24
  D4 -> GPIO23   D5 -> GPIO17   D6 -> GPIO18   D7 -> GPIO22

Runs as its own systemd service (see SETUP_COMMANDS.txt), independent of the
Node server -- these instructions are how the user finds that server in the
first place, so the boot-instructions loop can't depend on it being up.

Once the camera stream is live, switches to a live scan view instead: row 2
shows distance to the surface and its difference from the focal distance;
row 1 shows sharpness%, replaced by a reposition/blur warning when blurry.
"""
import json
import os
import signal
import time
import urllib.error
import urllib.request

import RPi.GPIO as GPIO

RS_PIN = 25
E_PIN = 24
DATA_PINS = (23, 17, 18, 22)  # D4, D5, D6, D7

LCD_WIDTH = 16
LINE1_ADDR = 0x80
LINE2_ADDR = 0xC0
DISPLAY_OFF_CMD = 0x08

E_PULSE_S = 0.0005
E_DELAY_S = 0.0005

STEPS = [
    ('Step 1/3', '1. Connect to WLAN "PiHotspot"'),
    ('Step 2/3', '2. Access 192.168.100.184:3000'),
    ('Step 3/3', '3. Tap Livestream, Enable Camera'),
]

SCROLL_STEP_S = 0.4
SCROLL_PAUSE_S = 1.5
STATIC_HOLD_S = 3

SERVER_BASE_URL = f'http://127.0.0.1:{os.environ.get("WIFI_SERVER_PORT", "3001")}'
HTTP_TIMEOUT_S = 1.0
# /api/distance and /api/sharpness spawn their own Python subprocess on the
# server and can legitimately take a while, especially while the camera
# stream is also eating CPU. These MUST stay comfortably above index.js's
# own DISTANCE_TIMEOUT_MS / SHARPNESS_TIMEOUT_MS -- if the LCD gives up
# first, both fields sit on "--" forever even though the server would have
# come back with a real reading a moment later.
DISTANCE_HTTP_TIMEOUT_S = 3.0
# /api/sharpness imports cv2, which is slow to start on Pi hardware.
SHARPNESS_HTTP_TIMEOUT_S = 7.0
SHARPNESS_POLL_INTERVAL_S = 3.0
SCAN_POLL_INTERVAL_S = 0.5

FOCAL_DISTANCE_CM = 30  # keep in sync with idealFocalDistanceCm in src/App.jsx
FOCAL_TOLERANCE_CM = 5


def lcd_toggle_enable():
    time.sleep(E_DELAY_S)
    GPIO.output(E_PIN, True)
    time.sleep(E_PULSE_S)
    GPIO.output(E_PIN, False)
    time.sleep(E_DELAY_S)


def lcd_send_nibble(nibble):
    for pin, bit in zip(DATA_PINS, (0, 1, 2, 3)):
        GPIO.output(pin, (nibble >> bit) & 1)
    lcd_toggle_enable()


def lcd_send_byte(byte, is_data):
    GPIO.output(RS_PIN, is_data)
    lcd_send_nibble(byte >> 4)
    lcd_send_nibble(byte & 0x0F)


def lcd_init():
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(RS_PIN, GPIO.OUT)
    GPIO.setup(E_PIN, GPIO.OUT)
    for pin in DATA_PINS:
        GPIO.setup(pin, GPIO.OUT)

    time.sleep(0.05)
    for command in (0x33, 0x32, 0x28, 0x0C, 0x06, 0x01):
        lcd_send_byte(command, is_data=False)
    time.sleep(0.005)


def lcd_write_line(text, addr):
    lcd_send_byte(addr, is_data=False)
    for char in text[:LCD_WIDTH].ljust(LCD_WIDTH):
        lcd_send_byte(ord(char), is_data=True)


def display_step(label, message):
    lcd_write_line(label, LINE1_ADDR)

    if len(message) <= LCD_WIDTH:
        lcd_write_line(message, LINE2_ADDR)
        time.sleep(STATIC_HOLD_S)
        return

    scroll_text = message + '  '
    doubled = scroll_text + scroll_text
    for offset in range(len(scroll_text)):
        lcd_write_line(doubled[offset:offset + LCD_WIDTH], LINE2_ADDR)
        time.sleep(SCROLL_STEP_S)
    time.sleep(SCROLL_PAUSE_S)


def fetch_json(path, timeout=HTTP_TIMEOUT_S):
    with urllib.request.urlopen(SERVER_BASE_URL + path, timeout=timeout) as response:
        return json.loads(response.read())


def fetch_streaming():
    try:
        return bool(fetch_json('/api/camera/stats').get('streaming'))
    except (urllib.error.URLError, OSError, ValueError):
        return False


def fetch_distance_cm():
    try:
        return fetch_json('/api/distance', timeout=DISTANCE_HTTP_TIMEOUT_S).get('distanceCm')
    except (urllib.error.URLError, OSError, ValueError):
        return None


def fetch_sharpness():
    try:
        data = fetch_json('/api/sharpness', timeout=SHARPNESS_HTTP_TIMEOUT_S)
        return data.get('blurry'), data.get('sharpnessPercent')
    except (urllib.error.URLError, OSError, ValueError):
        return None, None


def scan_lines(distance_cm, blurry, sharpness_percent):
    if distance_cm is None:
        line2 = 'Distance: --'
    else:
        diff_cm = distance_cm - FOCAL_DISTANCE_CM
        dist_text = f'{distance_cm:.1f}cm'
        diff_text = f'{diff_cm:+.1f}cm'
        line2 = dist_text.ljust(LCD_WIDTH - len(diff_text)) + diff_text

    if blurry and distance_cm is not None and abs(distance_cm - FOCAL_DISTANCE_CM) > FOCAL_TOLERANCE_CM:
        line1 = 'Move closer' if distance_cm > FOCAL_DISTANCE_CM else 'Move farther'
    elif blurry:
        line1 = 'Image blurred'
    elif sharpness_percent is None:
        line1 = 'Sharpness: --'
    else:
        line1 = f'Sharpness: {sharpness_percent}%'

    return line1, line2


def lcd_off():
    # Blank both lines and drop the HD44780's own display bit, so the panel
    # goes dark right away instead of freezing on whatever it was mid-render
    # when the shutdown signal arrived and staying lit until the Pi's power
    # actually cuts a few seconds later.
    lcd_write_line('', LINE1_ADDR)
    lcd_write_line('', LINE2_ADDR)
    lcd_send_byte(DISPLAY_OFF_CMD, is_data=False)


# systemd sends SIGTERM (not SIGINT) to stop this service, including during
# `poweroff`/`reboot` -- systemd stops services before the actual power-off
# happens, but Python doesn't turn SIGTERM into KeyboardInterrupt on its own,
# so without this the process was just killed mid-frame, leaving the LCD
# showing stale content until power cut rather than turning off first.
def handle_shutdown_signal(signum, frame):
    raise SystemExit(0)


signal.signal(signal.SIGTERM, handle_shutdown_signal)


def main():
    lcd_init()
    last_blurry = None
    last_sharpness_percent = None
    next_sharpness_check = 0.0
    try:
        while True:
            if not fetch_streaming():
                for label, message in STEPS:
                    display_step(label, message)
                    if fetch_streaming():
                        break
                continue

            now = time.monotonic()
            if now >= next_sharpness_check:
                last_blurry, last_sharpness_percent = fetch_sharpness()
                next_sharpness_check = now + SHARPNESS_POLL_INTERVAL_S

            line1, line2 = scan_lines(fetch_distance_cm(), last_blurry, last_sharpness_percent)
            lcd_write_line(line1, LINE1_ADDR)
            lcd_write_line(line2, LINE2_ADDR)
            time.sleep(SCAN_POLL_INTERVAL_S)
    except KeyboardInterrupt:
        pass
    finally:
        lcd_off()
        GPIO.cleanup()


if __name__ == '__main__':
    main()
