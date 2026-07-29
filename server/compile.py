"""Builds a composite of the scanned Braille surface out of the raw camera stills.

Pipeline: clean output/ -> for each image in input/, skip it unless it's sharp
and near-flat (<5 deg skew) -> detect the braille dot centers in it, along
with each dot's raking-light polarity (bump facing the camera vs. a dimple
facing away, see classify_dot_polarity) -> try to align it onto an existing
output image by finding a rotation+translation that lines up enough of its
dots (position *and* polarity) with that image's dots -> if nothing
correlates, seed a new output image with it -> clean input/.

Alignment is done from the dot *positions* rather than generic ORB/SIFT
features: a braille dot grid is highly repetitive texture, so descriptor
matching on the dots themselves (or on the surrounding paper) is unreliable -
lots of dots look alike. Two dot grids that really overlap, however, share a
large set of points related by a single rigid transform (the camera only
translates/rotates between shots, it doesn't warp the paper), so a RANSAC
search over that transform is a much more direct fit for this data than
feature descriptors are.

Position alone is still ambiguous on a periodic grid: a transform that's off
by exactly one dot pitch lines up almost as many points as the true one does,
since every dot has a look-alike neighbor one pitch away in each direction.
Each dot's polarity (see src/lib/crescentDetect.js's classifyDotDirection,
which this mirrors) breaks that tie - it's read straight off the raking-light
shading and doesn't depend on position at all, so requiring it to agree is an
independent check that a merely periodic mismatch can't satisfy by accident.
"""
import glob
import os
import sys
from collections import defaultdict

import cv2
import numpy as np

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(SERVER_DIR, '..', 'raspimages')
OUTPUT_DIR = os.path.join(SERVER_DIR, '..', 'output')

SHARPNESS_THRESHOLD = 100.0   # variance of Laplacian; below this, image is too blurry
# Laplacian variance scales with resolution (more pixels means more high-frequency
# detail for the same real sharpness), so it's only comparable to a fixed
# threshold at a fixed sample size. Matches src/lib/sharpness.js's
# SHARPNESS_SAMPLE_WIDTH/HEIGHT so a photo the client already judged sharp isn't
# re-judged blurry here just because it's being read at full camera resolution.
SHARPNESS_SAMPLE_WIDTH = 160
SHARPNESS_SAMPLE_HEIGHT = 120
MAX_ANGLE_DEGREES = 5.0       # max acceptable skew of the paper/text in frame

# Dot detection. Same size-fraction assumptions as src/lib/crescentDetect.js
# (MIN/MAX_RADIUS_FRACTION), since both read the same physical setup: a fixed
# focal distance, so a dot's radius as a fraction of the frame is stable.
DOT_MIN_RADIUS_FRACTION = 0.035
DOT_MAX_RADIUS_FRACTION = 0.085
MAX_DOTS_PER_IMAGE = 150      # bounds RANSAC cost; excess low-confidence circles are dropped

# Polarity classification (bump-facing-camera vs. dimple-facing-away). Mirrors
# the constants in src/lib/crescentDetect.js so the two readings of the same
# physical dots agree.
LOCAL_BRIGHTNESS_SIGMA_RADIUS_MULTIPLE = 1.6
LOCAL_BRIGHTNESS_MIN_STD = 0.75
LOCAL_BRIGHTNESS_CLIP_STD = 2.5
# Sampling this close to the rim (previously 0.85-1.3r) put most of the band on or
# past the dot's own boundary, averaging in the flat paper beside it rather than the
# dome's own shading, which is strong across the whole disc, not just a thin ring at
# the edge. See src/lib/crescentDetect.js's matching change.
EDGE_SAMPLE_INNER_RADIUS_MULTIPLE = 0.15
EDGE_SAMPLE_OUTER_RADIUS_MULTIPLE = 0.95
EDGE_SAMPLE_RADIAL_STEPS = 6
EDGE_SAMPLE_HALF_ANGLE_SAMPLES = 16
DOT_DIRECTION_ANGLE_SAMPLES = 24

# Dot-based alignment (RANSAC over rigid transforms).
# 5 sounds low, but each inlier here is already load-bearing on its own: it has
# to land within POINT_MATCH_TOLERANCE_PX under a single shared rigid
# transform *and* agree in polarity, and a wrong-by-one-pitch transform (the
# periodic-grid ambiguity described up top) would have to fake that same
# polarity pattern at the grid's own period to slip through. That combination
# makes 5 clean inliers already a strong signal; real overlapping photos were
# being rejected one dot short of the old threshold of 6.
MIN_DOT_MATCHES = 5           # aligned dot pairs required to call two images connected
DOT_RANSAC_ITERATIONS = 800
POINT_MATCH_TOLERANCE_PX = 6.0   # how close a transformed dot must land to a real dot to count
PAIR_DISTANCE_TOLERANCE_PX = 4.0 # how closely two pivot-pair distances must agree to try a transform
MIN_PIVOT_DISTANCE_PX = 10.0     # ignore near-duplicate pivot points; their rotation estimate is unstable
# A grid is periodic, so many pivot pairs share the same spacing - once a
# transform already explains a clear majority of both dot sets there's
# nothing to gain from grinding through the rest of the RANSAC budget.
EARLY_EXIT_FRACTION = 0.6
MAX_CANVAS_DIMENSION = 6000   # guards against a bad transform blowing up the merged canvas

RNG = np.random.default_rng()


def clean_dir(path):
    for f in glob.glob(os.path.join(path, '*')):
        if os.path.isfile(f):
            os.remove(f)


def is_sharp(gray):
    # Resized to the same fixed sample size the client scores sharpness at
    # (see SHARPNESS_SAMPLE_WIDTH/HEIGHT above) before stretching to the full
    # 0-255 range -- stretch first, Laplacian variance scales with contrast as
    # well as focus, so a washed-out/flatly-lit still (embossed dots close in
    # tone to the background) would otherwise read as blurry even in perfect
    # focus. See src/lib/sharpness.js for the matching client-side check.
    small = cv2.resize(gray, (SHARPNESS_SAMPLE_WIDTH, SHARPNESS_SAMPLE_HEIGHT))
    stretched = cv2.normalize(small, None, 0, 255, cv2.NORM_MINMAX)
    return cv2.Laplacian(stretched, cv2.CV_64F).var() >= SHARPNESS_THRESHOLD


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


def _bilinear_sample(field, x, y):
    h, w = field.shape
    cx = min(max(x, 0.0), w - 1.001)
    cy = min(max(y, 0.0), h - 1.001)
    x0, y0 = int(cx), int(cy)
    x1, y1 = x0 + 1, y0 + 1
    wx, wy = cx - x0, cy - y0
    v00, v01 = field[y0, x0], field[y0, x1]
    v10, v11 = field[y1, x0], field[y1, x1]
    top = v00 + (v01 - v00) * wx
    bottom = v10 + (v11 - v10) * wx
    return top + (bottom - top) * wy


def _sample_ring_direction_vector(relative, cx, cy, r):
    """Each candidate dot's own ring is a clean read of its bump's
    bright-to-dark axis: sampling only reaches pixels within EDGE_SAMPLE's
    band around that one dot, so it can't pick up a page-wide brightness
    blob. Returns a (vx, vy) vector: the angle a real embossed dot's own
    brightness peaks toward, weighted by how pronounced that peak is (a
    near-flat ring, e.g. from a false-positive candidate, contributes little).
    """
    inner = r * EDGE_SAMPLE_INNER_RADIUS_MULTIPLE
    outer = r * EDGE_SAMPLE_OUTER_RADIUS_MULTIPLE
    steps = EDGE_SAMPLE_RADIAL_STEPS
    samples = DOT_DIRECTION_ANGLE_SAMPLES
    values = np.empty(samples, dtype=np.float64)
    for a in range(samples):
        theta = (a / samples) * 2 * np.pi
        total = 0.0
        for s in range(steps):
            frac = 0.5 if steps == 1 else s / (steps - 1)
            sample_r = inner + frac * (outer - inner)
            sx = cx + np.cos(theta) * sample_r
            sy = cy + np.sin(theta) * sample_r
            total += _bilinear_sample(relative, sx, sy)
        values[a] = total / steps

    mean = values.mean()
    vx = 0.0
    vy = 0.0
    for a in range(samples):
        theta = (a / samples) * 2 * np.pi
        weight = values[a] - mean
        vx += np.cos(theta) * weight
        vy += np.sin(theta) * weight
    return vx, vy


def estimate_consensus_light_angle(relative, points, radii):
    """A single sum-then-arctan2 over the whole frame's own pixel gradient -
    or a smoothed field of it - conflates the raking light's genuinely subtle
    shading with any large, unrelated brightness contrast the frame happens
    to contain: the page sitting on a darker table, a printed logo, a shadow.
    That contrast is far stronger than the light's own gradient, so it
    dominates the estimate. Measured on a real capture with a visible
    page/table boundary, plotting that frame-gradient direction as a hue
    wheel across the image showed a textbook vortex centered on the page -
    i.e. it was reading "which way is the brighter paper from here", not the
    actual light source, which misclassified every dot near that boundary.

    Since real embossed dots on one page are physically bumps of one
    consistent handedness, summing every candidate's own ring axis (see
    _sample_ring_direction_vector) into one consensus vector recovers the
    true light direction for the whole page without ever touching a
    page-level pixel gradient.
    """
    sum_x = 0.0
    sum_y = 0.0
    for (cx, cy), r in zip(points, radii):
        vx, vy = _sample_ring_direction_vector(relative, cx, cy, r)
        sum_x += vx
        sum_y += vy
    return float(np.arctan2(sum_y, sum_x))


def local_relative_brightness(gray, sigma):
    """Per-pixel brightness expressed as a clipped z-score against its own
    local neighborhood, so shading is comparable across differently-lit
    regions of the same page."""
    gray_f = gray.astype(np.float32)
    mean = cv2.GaussianBlur(gray_f, (0, 0), sigma)
    mean_sq = cv2.GaussianBlur(gray_f * gray_f, (0, 0), sigma)
    variance = np.maximum(0, mean_sq - mean * mean)
    std = np.sqrt(variance)
    clip = LOCAL_BRIGHTNESS_CLIP_STD
    with np.errstate(divide='ignore', invalid='ignore'):
        z = np.where(std > LOCAL_BRIGHTNESS_MIN_STD, (gray_f - mean) / std, 0.0)
    z = np.clip(z, -clip, clip)
    return ((z + clip) / (2 * clip)) * 255.0


def _sample_half_ring_brightness(relative, cx, cy, r, center_angle):
    """Average locally-normalized brightness over the half of the dot's disc
    centered on center_angle (a 180-degree wedge), sampled across most of the
    disc's radius rather than just a thin band at the rim."""
    inner = r * EDGE_SAMPLE_INNER_RADIUS_MULTIPLE
    outer = r * EDGE_SAMPLE_OUTER_RADIUS_MULTIPLE
    steps = EDGE_SAMPLE_RADIAL_STEPS
    samples = EDGE_SAMPLE_HALF_ANGLE_SAMPLES
    total = 0.0
    for s in range(steps):
        frac = 0.5 if steps == 1 else s / (steps - 1)
        sample_r = inner + frac * (outer - inner)
        for a in range(samples):
            theta = center_angle - np.pi / 2 + ((a + 0.5) / samples) * np.pi
            sx = cx + np.cos(theta) * sample_r
            sy = cy + np.sin(theta) * sample_r
            total += _bilinear_sample(relative, sx, sy)
    return total / (steps * samples)


def classify_dot_polarity(gray, enhanced, points, radii):
    """For each dot, compare brightness on the side of its rim facing the
    page's light source against the far side. A convex bump's near rim
    catches the light directly and reads bright while its far rim
    self-shadows; a concave dimple is the mirror image. Returns a bool array,
    True where the dot reads as a bump facing the camera."""
    if len(points) == 0:
        return np.empty((0,), dtype=bool)

    sigma = float(np.max(radii)) * LOCAL_BRIGHTNESS_SIGMA_RADIUS_MULTIPLE if len(radii) else 1.0
    relative = local_relative_brightness(enhanced, max(sigma, 1.0))
    light_angle = estimate_consensus_light_angle(relative, points, radii)

    polarity = np.empty(len(points), dtype=bool)
    for i, ((cx, cy), r) in enumerate(zip(points, radii)):
        toward = _sample_half_ring_brightness(relative, cx, cy, r, light_angle)
        away = _sample_half_ring_brightness(relative, cx, cy, r, light_angle + np.pi)
        polarity[i] = toward > away
    return polarity


def detect_dots(gray):
    """Return (points, polarity): an (N, 2) array of braille dot centers
    (x, y) in `gray`, and a matching (N,) bool array of each dot's polarity
    (see classify_dot_polarity)."""
    short = min(gray.shape)
    min_r = max(3, int(round(short * DOT_MIN_RADIUS_FRACTION)))
    max_r = max(min_r + 2, int(round(short * DOT_MAX_RADIUS_FRACTION)))

    enhanced = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(gray)
    blurred = cv2.GaussianBlur(enhanced, (5, 5), 1.2)
    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=max_r * 1.1,
        param1=80, param2=22, minRadius=min_r, maxRadius=max_r,
    )
    if circles is None:
        return np.empty((0, 2), dtype=np.float64), np.empty((0,), dtype=bool)

    points = circles[0][:, :2].astype(np.float64)[:MAX_DOTS_PER_IMAGE]
    radii = circles[0][:, 2].astype(np.float64)[:MAX_DOTS_PER_IMAGE]
    polarity = classify_dot_polarity(gray, enhanced, points, radii)
    return points, polarity


def _similarity_from_pair(p1, p2, q1, q2):
    # Rotation+uniform-scale+translation that maps p1->q1 and p2->q2 exactly,
    # with no reflection (the camera only rotates/translates over the page).
    vp = p2 - p1
    vq = q2 - q1
    norm_vp = np.hypot(*vp)
    if norm_vp < 1e-6:
        return None
    scale = np.hypot(*vq) / norm_vp
    theta = np.arctan2(vq[1], vq[0]) - np.arctan2(vp[1], vp[0])
    c, s = np.cos(theta), np.sin(theta)
    r = scale * np.array([[c, -s], [s, c]])
    t = q1 - r @ p1
    return np.column_stack([r, t])


def _apply_transform(m, points):
    return (m[:, :2] @ points.T).T + m[:, 2]


def _count_inliers(m, pts_new, pts_base, pol_new, pol_base):
    """A candidate correspondence only counts if, on top of landing within
    POINT_MATCH_TOLERANCE_PX, its polarity agrees too. On a periodic grid the
    nearest point by distance alone is often just the next dot over rather
    than the true match, and a wrong-by-one-pitch transform can clear the
    same distance tolerance as the true one over most of the grid - polarity
    is read straight off the raking-light shading, independent of position,
    so requiring it to agree as well rejects those false matches instead of
    counting them as support for a bad transform."""
    transformed = _apply_transform(m, pts_new)
    dists = np.sqrt(((transformed[:, None, :] - pts_base[None, :, :]) ** 2).sum(axis=2))
    if len(pol_new) and len(pol_base):
        dists = np.where(pol_new[:, None] == pol_base[None, :], dists, np.inf)
    nearest_idx = dists.argmin(axis=1)
    nearest_dist = dists[np.arange(len(pts_new)), nearest_idx]
    mask = nearest_dist <= POINT_MATCH_TOLERANCE_PX
    return mask, nearest_idx


def estimate_dot_alignment(pts_new, pol_new, pts_base, pol_base):
    """Search for the rigid transform mapping `pts_new` onto `pts_base`,
    using each dot's polarity (bump vs. dimple, see classify_dot_polarity) to
    disambiguate matches on top of position.

    Returns (matrix, inlier_count). matrix is a 2x3 array mapping points in
    the new image's pixel space into the base image's pixel space, or None
    if no transform cleared MIN_DOT_MATCHES aligned dots.
    """
    if len(pts_new) < MIN_DOT_MATCHES or len(pts_base) < MIN_DOT_MATCHES:
        return None, 0

    iu, ju = np.triu_indices(len(pts_base), k=1)
    base_dists = np.hypot(*(pts_base[iu] - pts_base[ju]).T)
    buckets = defaultdict(list)
    for k, l, d in zip(iu.tolist(), ju.tolist(), base_dists.tolist()):
        if d < MIN_PIVOT_DISTANCE_PX:
            continue
        buckets[round(d / PAIR_DISTANCE_TOLERANCE_PX)].append((k, l, d))
    if not buckets:
        return None, 0

    n_new = len(pts_new)
    early_exit_at = max(MIN_DOT_MATCHES, int(EARLY_EXIT_FRACTION * min(n_new, len(pts_base))))

    best_m = None
    best_inliers = 0

    for _ in range(DOT_RANSAC_ITERATIONS):
        i, j = RNG.choice(n_new, size=2, replace=False)
        p1, p2 = pts_new[i], pts_new[j]
        d_ij = np.hypot(*(p2 - p1))
        if d_ij < MIN_PIVOT_DISTANCE_PX:
            continue

        key = round(d_ij / PAIR_DISTANCE_TOLERANCE_PX)
        candidates = buckets.get(key - 1, []) + buckets.get(key, []) + buckets.get(key + 1, [])
        if not candidates:
            continue
        k, l, d_kl = candidates[RNG.integers(len(candidates))]
        if abs(d_ij - d_kl) > PAIR_DISTANCE_TOLERANCE_PX:
            continue
        q1, q2 = pts_base[k], pts_base[l]

        # Two possible correspondences for a matched pair (q1,q2) vs (q2,q1);
        # only one of them will explain the rest of the points. A pivot
        # assignment whose polarity doesn't even agree at the two pivot
        # points can't be the right one, so it's skipped before spending a
        # transform + full inlier count on it.
        for b1, b2, pb1, pb2 in ((q1, q2, pol_base[k], pol_base[l]), (q2, q1, pol_base[l], pol_base[k])):
            if pb1 != pol_new[i] or pb2 != pol_new[j]:
                continue
            m = _similarity_from_pair(p1, p2, b1, b2)
            if m is None:
                continue
            mask, _ = _count_inliers(m, pts_new, pts_base, pol_new, pol_base)
            inliers = int(mask.sum())
            if inliers > best_inliers:
                best_inliers = inliers
                best_m = m
                if best_inliers >= early_exit_at:
                    break
        if best_inliers >= early_exit_at:
            break

    if best_m is None or best_inliers < MIN_DOT_MATCHES:
        return None, best_inliers

    # Refine using every inlier correspondence, not just the two pivot points.
    mask, nearest_idx = _count_inliers(best_m, pts_new, pts_base, pol_new, pol_base)
    if mask.sum() >= 3:
        refined, inlier_mask = cv2.estimateAffinePartial2D(
            pts_new[mask].astype(np.float32),
            pts_base[nearest_idx[mask]].astype(np.float32),
            method=cv2.RANSAC,
            ransacReprojThreshold=POINT_MATCH_TOLERANCE_PX,
        )
        if refined is not None:
            best_m = refined
            best_inliers = int(_count_inliers(best_m, pts_new, pts_base, pol_new, pol_base)[0].sum())

    return best_m, best_inliers


def merge_into_canvas(base_bgr, new_bgr, m):
    """Warp `new_bgr` into `base_bgr`'s frame via `m` and mesh them into one
    canvas, growing it to fit whichever image lands outside the other."""
    h_b, w_b = base_bgr.shape[:2]
    h_n, w_n = new_bgr.shape[:2]

    corners = np.array([[0, 0], [w_n, 0], [w_n, h_n], [0, h_n]], dtype=np.float64)
    transformed_corners = _apply_transform(m, corners)
    all_x = np.concatenate([transformed_corners[:, 0], [0, w_b]])
    all_y = np.concatenate([transformed_corners[:, 1], [0, h_b]])
    min_x, max_x = np.floor(all_x.min()), np.ceil(all_x.max())
    min_y, max_y = np.floor(all_y.min()), np.ceil(all_y.max())
    out_w, out_h = int(max_x - min_x), int(max_y - min_y)
    if out_w <= 0 or out_h <= 0 or out_w > MAX_CANVAS_DIMENSION or out_h > MAX_CANVAS_DIMENSION:
        return None

    offset = np.array([-min_x, -min_y])
    base_m = np.array([[1.0, 0.0, offset[0]], [0.0, 1.0, offset[1]]])
    new_m = m.copy()
    new_m[:, 2] += offset

    # BORDER_REPLICATE (rather than the default zero-fill) keeps color from
    # smearing black into a rotated warp's edge pixels; pairing that with a
    # nearest-neighbor mask (no bilinear half-coverage rim) means the seam
    # finder below never mistakes a warp border artifact for real content.
    base_warp = cv2.warpAffine(base_bgr, base_m, (out_w, out_h), borderMode=cv2.BORDER_REPLICATE)
    base_mask = cv2.warpAffine(np.full((h_b, w_b), 255, dtype=np.uint8), base_m, (out_w, out_h), flags=cv2.INTER_NEAREST)
    new_warp = cv2.warpAffine(new_bgr, new_m, (out_w, out_h), borderMode=cv2.BORDER_REPLICATE)
    new_mask = cv2.warpAffine(np.full((h_n, w_n), 255, dtype=np.uint8), new_m, (out_w, out_h), flags=cv2.INTER_NEAREST)

    # A flat average across the whole overlap ghosts as soon as the rigid fit
    # is off by even a couple of pixels - which is near-inevitable, since the
    # dot alignment only constrains the matched dots themselves, and real
    # photos also differ in framing/lighting outside them. Finding a seam and
    # blending only across it, the way panorama stitchers do, hides that
    # residual error instead of doubling it into a visible double exposure.
    seam_finder = cv2.detail_DpSeamFinder('COLOR')
    seam_masks = seam_finder.find(
        [base_warp.astype(np.float32), new_warp.astype(np.float32)],
        [(0, 0), (0, 0)],
        [base_mask.copy(), new_mask.copy()],
    )

    blender = cv2.detail_MultiBandBlender()
    blender.prepare((0, 0, out_w, out_h))
    blender.feed(base_warp.astype(np.int16), seam_masks[0], (0, 0))
    blender.feed(new_warp.astype(np.int16), seam_masks[1], (0, 0))
    result, _ = blender.blend(None, None)
    return np.clip(result, 0, 255).astype(np.uint8)


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
    dots_cache = {}  # output path -> detected dot centers, invalidated on write

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

        new_points, new_polarity = detect_dots(gray)

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
                dots_cache[out_path] = detect_dots(out_gray)
            out_points, out_polarity = dots_cache[out_path]

            m, inliers = estimate_dot_alignment(new_points, new_polarity, out_points, out_polarity)
            if m is None or inliers < MIN_DOT_MATCHES:
                continue

            merged_canvas = merge_into_canvas(out_img, img, m)
            if merged_canvas is not None:
                cv2.imwrite(out_path, merged_canvas)
                del dots_cache[out_path]
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
