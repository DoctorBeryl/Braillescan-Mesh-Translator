"""Takes a batch of HC-SR04 ultrasonic readings and prints their average as JSON.

Wired to the Pi's physical header: TRIG on pin 29, ECHO on pin 31 (BOARD
numbering), matching the "Distance to surface" stat on the Livestream tab.

Four readings are taken per invocation, each with a quarter of the settle
delay a single reading used to use, so the whole batch fits in the time one
reading previously took. The server-side smoothing (EMA against the last
output) lives in index.js, since this script is spawned fresh each poll and
has no memory of prior invocations.
"""
import json
import sys
import time

TRIG_PIN = 29
ECHO_PIN = 31
PULSE_TIMEOUT_S = 0.05
SPEED_OF_SOUND_CM_S = 34300
READINGS_PER_BATCH = 4
TRIGGER_SETTLE_S = 0.05 / READINGS_PER_BATCH


def measure_batch(n=READINGS_PER_BATCH):
    import RPi.GPIO as GPIO

    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BOARD)
    GPIO.setup(TRIG_PIN, GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(ECHO_PIN, GPIO.IN)
    try:
        readings = []
        for _ in range(n):
            time.sleep(TRIGGER_SETTLE_S)

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
            readings.append((duration * SPEED_OF_SOUND_CM_S) / 2)
        return readings
    finally:
        GPIO.cleanup((TRIG_PIN, ECHO_PIN))


def main():
    try:
        readings = measure_batch()
        average_cm = sum(readings) / len(readings)
        print(json.dumps({
            'distanceCm': round(average_cm, 1),
            'readings': [round(r, 1) for r in readings],
        }))
    except Exception as exc:
        print(json.dumps({'error': str(exc)}))


if __name__ == '__main__':
    main()
    sys.exit(0)
