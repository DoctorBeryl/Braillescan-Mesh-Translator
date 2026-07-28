// Detects crescent-shaped highlights/shadows in a still -- the signature an
// embossed Braille dot leaves under angled light (one side of the bump lit,
// the other in shadow, each a partial arc rather than a filled disk).
//
// Approach: binarize the frame both ways (bright-blob-on-dark and
// dark-blob-on-bright, since "any contrast level" means we don't know which
// side of the surface is lit), find connected blobs, and score each one
// against shape descriptors that a crescent satisfies but a filled disk,
// thin scratch, or noise speck doesn't:
//   - fill ratio: area vs. the area of the smallest circle enclosing it.
//     A filled dot is close to 1; a thin ring/crescent is a fraction of it.
//   - solidity: area vs. convex-hull area. A crescent is concave (its hull
//     bridges the "bite" taken out of it), so solidity sits well below 1;
//     a disk is already convex, so its solidity is close to 1.
//   - circularity: 4*pi*area / perimeter^2. Disks score high, jagged noise
//     scores low, a smooth arc lands in between.
// All three are rotation-invariant, so a crescent is recognized "pointing"
// any direction without needing to search over orientations.

const MIN_COMPONENT_AREA = 6
const MAX_COMPONENT_AREA_FRACTION = 0.02
const MIN_ASPECT_RATIO = 0.3
const MAX_ASPECT_RATIO = 3.3
const MIN_FILL_RATIO = 0.15
const MAX_FILL_RATIO = 0.68
const MIN_SOLIDITY = 0.3
const MAX_SOLIDITY = 0.88
const MIN_CIRCULARITY = 0.1
const MAX_CIRCULARITY = 0.82
const MIN_CRESCENTS_REQUIRED = 2
// Flood fill visits every pixel of every blob; cap the analysis resolution
// so a batch of dozens of stills stays fast in the browser.
const MAX_DETECT_DIMENSION = 260

function toGrayscale(data, width, height) {
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return gray
}

// Stretches to the full 0-255 range so the same thresholds work regardless
// of how flatly or richly lit the source still is.
function stretchContrast(gray) {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < gray.length; i += 1) {
    if (gray[i] < min) min = gray[i]
    if (gray[i] > max) max = gray[i]
  }
  const range = max - min
  if (range < 1) return gray
  const scale = 255 / range
  const out = new Float32Array(gray.length)
  for (let i = 0; i < gray.length; i += 1) out[i] = (gray[i] - min) * scale
  return out
}

// Otsu's method: picks the threshold that maximizes between-class variance
// of a 0-255 histogram -- an automatic split point instead of a fixed one,
// so it adapts to each still's own contrast.
function otsuThreshold(gray) {
  const hist = new Array(256).fill(0)
  for (let i = 0; i < gray.length; i += 1) {
    hist[Math.max(0, Math.min(255, gray[i] | 0))] += 1
  }
  const total = gray.length
  let sum = 0
  for (let t = 0; t < 256; t += 1) sum += t * hist[t]

  let sumB = 0
  let weightB = 0
  let best = 0
  let bestVariance = -1
  for (let t = 0; t < 256; t += 1) {
    weightB += hist[t]
    if (weightB === 0) continue
    const weightF = total - weightB
    if (weightF === 0) break
    sumB += t * hist[t]
    const meanB = sumB / weightB
    const meanF = (sum - sumB) / weightF
    const between = weightB * weightF * (meanB - meanF) * (meanB - meanF)
    if (between > bestVariance) {
      bestVariance = between
      best = t
    }
  }
  return best
}

// 4-connected flood fill labeling, iterative (stack-based) to avoid blowing
// the call stack on a large blob. Returns one descriptor per component.
function findComponents(mask, width, height) {
  const visited = new Uint8Array(width * height)
  const stack = new Int32Array(width * height)
  const components = []

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue

    let sp = 0
    stack[sp] = start
    sp += 1
    visited[start] = 1

    let area = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    let sumX = 0
    let sumY = 0
    const boundary = []

    while (sp > 0) {
      sp -= 1
      const idx = stack[sp]
      const x = idx % width
      const y = (idx / width) | 0

      area += 1
      sumX += x
      sumY += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      let onBoundary = false
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) onBoundary = true

      const left = x > 0 ? idx - 1 : -1
      const right = x < width - 1 ? idx + 1 : -1
      const up = y > 0 ? idx - width : -1
      const down = y < height - 1 ? idx + width : -1
      for (const nIdx of [left, right, up, down]) {
        if (nIdx === -1) continue
        if (!mask[nIdx]) {
          onBoundary = true
          continue
        }
        if (!visited[nIdx]) {
          visited[nIdx] = 1
          stack[sp] = nIdx
          sp += 1
        }
      }
      if (onBoundary) boundary.push([x, y])
    }

    components.push({
      area,
      perimeter: boundary.length,
      minX, maxX, minY, maxY,
      centroidX: sumX / area,
      centroidY: sumY / area,
      boundary,
    })
  }

  return components
}

function convexHullArea(points) {
  if (points.length < 3) return 0
  const pts = points.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]))
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1))
  if (hull.length < 3) return 0

  let area = 0
  for (let i = 0; i < hull.length; i += 1) {
    const [x1, y1] = hull[i]
    const [x2, y2] = hull[(i + 1) % hull.length]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}

function isCrescentShaped(component, imageArea) {
  const { area, perimeter, minX, maxX, minY, maxY, centroidX, centroidY, boundary } = component
  if (area < MIN_COMPONENT_AREA || area > imageArea * MAX_COMPONENT_AREA_FRACTION) return false

  const bboxWidth = maxX - minX + 1
  const bboxHeight = maxY - minY + 1
  const aspect = bboxWidth / bboxHeight
  if (aspect < MIN_ASPECT_RATIO || aspect > MAX_ASPECT_RATIO) return false

  let maxDist = 0
  for (const [x, y] of boundary) {
    const dx = x - centroidX
    const dy = y - centroidY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > maxDist) maxDist = dist
  }
  const radius = Math.max(maxDist, 1)
  const fillRatio = area / (Math.PI * radius * radius)
  if (fillRatio < MIN_FILL_RATIO || fillRatio > MAX_FILL_RATIO) return false

  const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0
  if (circularity < MIN_CIRCULARITY || circularity > MAX_CIRCULARITY) return false

  const hullArea = convexHullArea(boundary)
  const solidity = hullArea > 0 ? Math.min(1, area / hullArea) : 0
  if (solidity < MIN_SOLIDITY || solidity > MAX_SOLIDITY) return false

  return true
}

// Downscales onto `canvas` (reused across calls by the caller) and returns
// the ImageData used for detection, capped at MAX_DETECT_DIMENSION on the
// long edge to keep flood-fill cost bounded.
export function sampleForCrescentDetection(source, canvas, sourceWidth, sourceHeight) {
  const scale = Math.min(1, MAX_DETECT_DIMENSION / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

// Counts blobs in `imageData` whose shape matches a crescent, checking both
// polarities (bright arc on dark ground, and dark arc on bright ground).
export function countCrescentShapes(imageData) {
  const { data, width, height } = imageData
  const gray = stretchContrast(toGrayscale(data, width, height))
  const threshold = otsuThreshold(gray)
  const imageArea = width * height

  let crescents = 0
  for (const polarity of [1, 0]) {
    const mask = new Uint8Array(imageArea)
    for (let i = 0; i < gray.length; i += 1) {
      mask[i] = (polarity ? gray[i] > threshold : gray[i] <= threshold) ? 1 : 0
    }
    const components = findComponents(mask, width, height)
    for (const component of components) {
      if (isCrescentShaped(component, imageArea)) crescents += 1
    }
  }
  return crescents
}

export function hasCrescentShapes(imageData) {
  return countCrescentShapes(imageData) >= MIN_CRESCENTS_REQUIRED
}
