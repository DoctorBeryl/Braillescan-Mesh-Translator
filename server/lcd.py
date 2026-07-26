"""Drives a 16x2 HD44780 LCD (4-bit mode) so the setup instructions are
visible immediately after boot, before a monitor or SSH session is available.

Wired directly to BCM GPIO (RW tied to GND -- write-only, no read needed):
  RS -> GPIO25   E -> GPIO24
  D4 -> GPIO23   D5 -> GPIO17   D6 -> GPIO18   D7 -> GPIO22

Runs as its own systemd service (see SETUP_COMMANDS.txt), independent of the
Node server -- these instructions are how the user finds that server in the
first place, so the LCD loop can't depend on it being up.
"""
import time

import RPi.GPIO as GPIO

RS_PIN = 25
E_PIN = 24
DATA_PINS = (23, 17, 18, 22)  # D4, D5, D6, D7

LCD_WIDTH = 16
LINE1_ADDR = 0x80
LINE2_ADDR = 0xC0

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


def main():
    lcd_init()
    try:
        while True:
            for label, message in STEPS:
                display_step(label, message)
    except KeyboardInterrupt:
        pass
    finally:
        GPIO.cleanup()


if __name__ == '__main__':
    main()
