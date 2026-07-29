"""Ad-hoc test: run compile.py's dot-alignment merge algorithm against
test_images/input_new, writing results to test_images/output_new.

Does NOT touch the real raspimages/ or output/ dirs, and does NOT delete
the source images (unlike compile.main(), which cleans its input dir).
"""
import glob
import os
import sys

import cv2

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server'))
import compile as c  # noqa: E402

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(THIS_DIR, 'input_new')
OUTPUT_DIR = os.path.join(THIS_DIR, 'output_new')

os.makedirs(OUTPUT_DIR, exist_ok=True)
c.clean_dir(OUTPUT_DIR)

input_paths = sorted(
    p for p in glob.glob(os.path.join(INPUT_DIR, '*')) if os.path.isfile(p)
)

seeded = 0
expanded = 0
skipped = 0
dots_cache = {}

for path in input_paths:
    name = os.path.basename(path)
    img = cv2.imread(path)
    if img is None:
        print(f'{name}: could not read, skipping')
        skipped += 1
        continue
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    if not c.is_sharp(gray):
        print(f'{name}: skipped (too blurry)')
        skipped += 1
        continue
    angle = c.skew_angle(gray)
    if abs(angle) > c.MAX_ANGLE_DEGREES:
        print(f'{name}: skipped (skew {angle:.1f} deg)')
        skipped += 1
        continue

    new_dots = c.detect_dots(gray)
    print(f'{name}: {len(new_dots)} dots detected, skew {angle:.1f} deg')

    output_paths = sorted(
        p for p in glob.glob(os.path.join(OUTPUT_DIR, '*')) if os.path.isfile(p)
    )

    merged = False
    for out_path in output_paths:
        out_img = cv2.imread(out_path)
        if out_img is None:
            continue

        if out_path not in dots_cache:
            out_gray = cv2.cvtColor(out_img, cv2.COLOR_BGR2GRAY)
            dots_cache[out_path] = c.detect_dots(out_gray)
        out_dots = dots_cache[out_path]

        m, inliers = c.estimate_dot_alignment(new_dots, out_dots)
        print(f'  vs {os.path.basename(out_path)}: {inliers} inlier dots '
              f'(need >= {c.MIN_DOT_MATCHES})')
        if m is None or inliers < c.MIN_DOT_MATCHES:
            continue

        merged_canvas = c.merge_into_canvas(out_img, img, m)
        if merged_canvas is not None:
            cv2.imwrite(out_path, merged_canvas)
            del dots_cache[out_path]
            merged = True
            expanded += 1
            print(f'  -> merged into {os.path.basename(out_path)}')
            break
        else:
            print('  -> alignment found but merge_into_canvas rejected the result')

    if not merged:
        seeded += 1
        out_name = f'piece_{seeded:04d}.jpg'
        cv2.imwrite(os.path.join(OUTPUT_DIR, out_name), img)
        print(f'  -> seeded new output image {out_name}')

print(
    f'\nProcessed {len(input_paths)} image(s): '
    f'{seeded} seeded, {expanded} expanded, {skipped} skipped.'
)
