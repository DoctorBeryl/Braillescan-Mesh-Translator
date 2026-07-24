"""Builds a composite of the scanned Braille surface out of the raw camera stills.

Pipeline: clean output/ -> for each image in input/, skip it unless it's sharp
and near-flat (<5 deg skew) -> try to stitch it onto an existing output image
via ORB features + homography -> if nothing correlates, seed a new output
image with it -> clean input/.
"""
import glob
import os
import sys

import cv2
import numpy as np

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(SERVER_DIR, '..', 'raspimages')
OUTPUT_DIR = os.path.join(SERVER_DIR, '..', 'output')

SHARPNESS_THRESHOLD = 100.0   # variance of Laplacian; below this, image is too blurry
MAX_ANGLE_DEGREES = 5.0       # max acceptable skew of the paper/text in frame
MIN_INLIERS = 15              # RANSAC-verified matches required to call two images correlated

orb = cv2.ORB_create(2000)
bf = cv2.BFMatcher(cv2.NORM_HAMMING)


def clean_dir(path):
    for f in glob.glob(os.path.join(path, '*')):
        if os.path.isfile(f):
            os.remove(f)


def is_sharp(gray):
    return cv2.Laplacian(gray, cv2.CV_64F).var() >= SHARPNESS_THRESHOLD


def skew_angle(gray):
    # Standard deskew recipe: fit a min-area rect around the ink/foreground
    # pixels and read its rotation off, normalized to +/-45 degrees.
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if coords.shape[0] < 2:
        return 0.0
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    return angle


def inlier_count(grayA, grayB):
    # Braille dot grids are highly repetitive, so a raw feature-match count is
    # unreliable -- geometric verification via RANSAC homography inliers is
    # what actually confirms the two images overlap the same surface.
    kpA, desA = orb.detectAndCompute(grayA, None)
    kpB, desB = orb.detectAndCompute(grayB, None)
    if desA is None or desB is None or len(kpA) < 4 or len(kpB) < 4:
        return 0

    matches = bf.knnMatch(desA, desB, k=2)
    good = []
    for pair in matches:
        if len(pair) != 2:
            continue
        m, n = pair
        if m.distance < 0.75 * n.distance:
            good.append(m)
    if len(good) < 4:
        return 0

    src_pts = np.float32([kpA[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst_pts = np.float32([kpB[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    _, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
    if mask is None:
        return 0
    return int(mask.sum())


def try_stitch(base_bgr, new_bgr):
    stitcher = cv2.Stitcher_create() if hasattr(cv2, 'Stitcher_create') else cv2.Stitcher.create()
    status, result = stitcher.stitch([base_bgr, new_bgr])
    if status == cv2.Stitcher_OK:
        return result
    return None


def main():
    os.makedirs(INPUT_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    clean_dir(OUTPUT_DIR)

    input_paths = sorted(
        p for p in glob.glob(os.path.join(INPUT_DIR, '*')) if os.path.isfile(p)
    )

    seeded = 0
    expanded = 0
    skipped = 0

    for path in input_paths:
        img = cv2.imread(path)
        if img is None:
            skipped += 1
            continue
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        if not is_sharp(gray):
            skipped += 1
            continue
        if abs(skew_angle(gray)) > MAX_ANGLE_DEGREES:
            skipped += 1
            continue

        output_paths = sorted(
            p for p in glob.glob(os.path.join(OUTPUT_DIR, '*')) if os.path.isfile(p)
        )

        merged = False
        for out_path in output_paths:
            out_img = cv2.imread(out_path)
            if out_img is None:
                continue
            out_gray = cv2.cvtColor(out_img, cv2.COLOR_BGR2GRAY)

            if inlier_count(gray, out_gray) < MIN_INLIERS:
                continue

            stitched = try_stitch(out_img, img)
            if stitched is not None:
                cv2.imwrite(out_path, stitched)
                merged = True
                expanded += 1
                break

        if not merged:
            seeded += 1
            out_name = f'piece_{seeded:04d}.jpg'
            cv2.imwrite(os.path.join(OUTPUT_DIR, out_name), img)

    clean_dir(INPUT_DIR)

    print(
        f'Processed {len(input_paths)} image(s): '
        f'{seeded} seeded, {expanded} expanded, {skipped} skipped.'
    )


if __name__ == '__main__':
    sys.exit(main())
