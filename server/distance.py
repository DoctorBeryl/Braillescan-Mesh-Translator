"""Takes a single HC-SR04 ultrasonic reading and prints it as JSON.

Wired to the Pi's physical header: TRIG on pin 29, ECHO on pin 31 (BOARD
numbering), matching the "Distance to surface" stat on the Livestream tab.
"""
import json
import sys
import time

TRIG_PIN = 29
ECHO_PIN = 31
PULSE_TIMEOUT_S = 0.05
SPEED_OF_SOUND_CM_S = 34300


def measure_once():
    import RPi.GPIO as GPIO

    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BOARD)
    GPIO.setup(TRIG_PIN, GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(ECHO_PIN, GPIO.IN)
    try:
        time.sleep(0.05)

        GPIO.output(TRIG_PIN, True)
        time.sleep(0.00002)
        GPIO.output(TRIG_PIN, False)

        start_wait = time.time()
        pulse_start = start_wait
        while GPIO.input(ECHO_PIN) == 0:
            pulse_start = time.time()
            if pulse_start - start_wait > PULSE_TIMEOUT_S:
                raise TimeoutError('Timed out waiting for echo to start.')

        end_wait = pulse_start
        pulse_end = pulse_start
        while GPIO.input(ECHO_PIN) == 1:
            pulse_end = time.time()
            if pulse_end - end_wait > PULSE_TIMEOUT_S:
                raise TimeoutError('Timed out waiting for echo to end.')

        duration = pulse_end - pulse_start
        return (duration * SPEED_OF_SOUND_CM_S) / 2
    finally:
        GPIO.cleanup((TRIG_PIN, ECHO_PIN))


def main():
    try:
        distance_cm = measure_once()
        print(json.dumps({'distanceCm': round(distance_cm, 1)}))
    except Exception as exc:
        print(json.dumps({'error': str(exc)}))


if __name__ == '__main__':
    main()
    sys.exit(0)
