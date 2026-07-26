"""Reports the blur/sharpness of the most recently saved camera still.

Reuses SHARPNESS_THRESHOLD from compile.py so this and the stitching
pipeline agree on what counts as blurry.
"""
import glob
import json
import os
import sys

import cv2

from compile import SHARPNESS_THRESHOLD

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(SERVER_DIR, '..', 'raspimages')

# Variance at/above which an image reads as 100% sharp.
SHARPNESS_REFERENCE_VARIANCE = SHARPNESS_THRESHOLD * 2


def latest_image_path():
    paths = [p for p in glob.glob(os.path.join(IMAGES_DIR, '*.jpg')) if os.path.isfile(p)]
    if not paths:
        return None
    return max(paths, key=os.path.getmtime)


def main():
    path = latest_image_path()
    if path is None:
        print(json.dumps({'error': 'No saved frames yet.'}))
        return

    img = cv2.imread(path)
    if img is None:
        print(json.dumps({'error': 'Could not read latest frame.'}))
        return

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    percent = round(min(100, variance / SHARPNESS_REFERENCE_VARIANCE * 100))
    print(json.dumps({
        'sharpness': round(variance, 1),
        'sharpnessPercent': max(0, percent),
        'blurry': variance < SHARPNESS_THRESHOLD,
    }))


if __name__ == '__main__':
    sys.exit(main())
