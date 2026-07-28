export const MIN_CRESCENTS_REQUIRED = 2
const MAX_DETECT_DIMENSION = 260

const MIN_RADIUS_FRACTION = 0.035
const MAX_RADIUS_FRACTION = 0.085
const CLAHE_TILE_RADIUS_MULTIPLE = 2.5
const CLAHE_CLIP_LIMIT = 3.0
const LOCAL_BRIGHTNESS_SIGMA_RADIUS_MULTIPLE = 1.6
const LOCAL_BRIGHTNESS_CLIP_STD = 2.5
const LOCAL_BRIGHTNESS_MIN_STD = 0.75
const GRADIENT_BLUR_SIGMA = 1.3
const MIN_ACCUMULATOR_DP = 1.0
const MAX_ACCUMULATOR_DP = 2.0
const ACCUMULATOR_DP_RADIUS_CONSTANT = 20
const MIN_DIST_RADIUS_MULTIPLE = 1.1
const MIN_RING_SUPPORT = 0.3
const MIN_RING_VOTES_ABSOLUTE = 14
const ARC_SECTORS = 16
// Real crescents are lit from one direction, so their edge support forms a single
// contiguous arc. Sharp interfering features like printed text corners (e.g. the
// repeated vertices of a letter like "w") can rack up the same total ring-fraction
// score by combining several disjoint corner fragments that happen to land on the
// same accumulator cell from different angles - this requires the winning fraction
// to come from one unbroken arc, not a scattered union, to tell the two apart.
const MIN_ARC_SECTORS = 4

function toGrayscale(data, width, height) {
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return gray
}

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

function clahe(gray, width, height, tilesX, tilesY, clipLimit) {
  const tileW = width / tilesX
  const tileH = height / tilesY

  const luts = new Array(tilesX * tilesY)
  for (let ty = 0; ty < tilesY; ty += 1) {
    const y0 = Math.floor(ty * tileH)
    const y1 = ty === tilesY - 1 ? height : Math.floor((ty + 1) * tileH)
    for (let tx = 0; tx < tilesX; tx += 1) {
      const x0 = Math.floor(tx * tileW)
      const x1 = tx === tilesX - 1 ? width : Math.floor((tx + 1) * tileW)

      const hist = new Float64Array(256)
      let count = 0
      for (let y = y0; y < y1; y += 1) {
        const row = y * width
        for (let x = x0; x < x1; x += 1) {
          hist[Math.max(0, Math.min(255, gray[row + x] | 0))] += 1
          count += 1
        }
      }

      const clip = Math.max(1, Math.round((clipLimit * count) / 256))
      let excess = 0
      for (let b = 0; b < 256; b += 1) {
        if (hist[b] > clip) {
          excess += hist[b] - clip
          hist[b] = clip
        }
      }
      const redistribute = excess / 256
      for (let b = 0; b < 256; b += 1) hist[b] += redistribute

      const lut = new Float32Array(256)
      let cdf = 0
      for (let b = 0; b < 256; b += 1) {
        cdf += hist[b]
        lut[b] = count > 0 ? (255 * cdf) / count : b
      }
      luts[ty * tilesX + tx] = lut
    }
  }

  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    let fy = (y + 0.5) / tileH - 0.5
    fy = Math.max(0, Math.min(tilesY - 1, fy))
    const ty0 = Math.floor(fy)
    const ty1 = Math.min(tilesY - 1, ty0 + 1)
    const wy = fy - ty0

    for (let x = 0; x < width; x += 1) {
      let fx = (x + 0.5) / tileW - 0.5
      fx = Math.max(0, Math.min(tilesX - 1, fx))
      const tx0 = Math.floor(fx)
      const tx1 = Math.min(tilesX - 1, tx0 + 1)
      const wx = fx - tx0

      const v = Math.max(0, Math.min(255, gray[y * width + x] | 0))
      const v00 = luts[ty0 * tilesX + tx0][v]
      const v01 = luts[ty0 * tilesX + tx1][v]
      const v10 = luts[ty1 * tilesX + tx0][v]
      const v11 = luts[ty1 * tilesX + tx1][v]
      const top = v00 + (v01 - v00) * wx
      const bottom = v10 + (v11 - v10) * wx
      out[y * width + x] = top + (bottom - top) * wy
    }
  }
  return out
}

function localRelativeBrightness(gray, width, height, sigma) {
  const mean = gaussianBlur(gray, width, height, sigma)
  const sq = new Float32Array(gray.length)
  for (let i = 0; i < gray.length; i += 1) sq[i] = gray[i] * gray[i]
  const meanSq = gaussianBlur(sq, width, height, sigma)

  const out = new Float32Array(gray.length)
  const clip = LOCAL_BRIGHTNESS_CLIP_STD
  for (let i = 0; i < gray.length; i += 1) {
    const variance = Math.max(0, meanSq[i] - mean[i] * mean[i])
    const std = Math.sqrt(variance)
    let z = std > LOCAL_BRIGHTNESS_MIN_STD ? (gray[i] - mean[i]) / std : 0
    if (z > clip) z = clip
    else if (z < -clip) z = -clip
    out[i] = ((z + clip) / (2 * clip)) * 255
  }
  return out
}

function gaussianBlur(gray, width, height, sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 3))
  const kernel = new Float32Array(radius * 2 + 1)
  let sum = 0
  for (let i = -radius; i <= radius; i += 1) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma))
    kernel[i + radius] = v
    sum += v
  }
  for (let i = 0; i < kernel.length; i += 1) kernel[i] /= sum

  const tmp = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      let acc = 0
      for (let k = -radius; k <= radius; k += 1) {
        const sx = Math.max(0, Math.min(width - 1, x + k))
        acc += gray[row + sx] * kernel[k + radius]
      }
      tmp[row + x] = acc
    }
  }
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let acc = 0
      for (let k = -radius; k <= radius; k += 1) {
        const sy = Math.max(0, Math.min(height - 1, y + k))
        acc += tmp[sy * width + x] * kernel[k + radius]
      }
      out[y * width + x] = acc
    }
  }
  return out
}

function sobelGradient(gray, width, height) {
  const gx = new Float32Array(width * height)
  const gy = new Float32Array(width * height)
  const mag = new Float32Array(width * height)

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - 1)
    const y1 = Math.min(height - 1, y + 1)
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - 1)
      const x1 = Math.min(width - 1, x + 1)

      const tl = gray[y0 * width + x0], tc = gray[y0 * width + x], tr = gray[y0 * width + x1]
      const ml = gray[y * width + x0], mr = gray[y * width + x1]
      const bl = gray[y1 * width + x0], bc = gray[y1 * width + x], br = gray[y1 * width + x1]

      const sx = (tr + 2 * mr + br) - (tl + 2 * ml + bl)
      const sy = (bl + 2 * bc + br) - (tl + 2 * tc + tr)
      const idx = y * width + x
      gx[idx] = sx
      gy[idx] = sy
      mag[idx] = Math.sqrt(sx * sx + sy * sy)
    }
  }
  return { gx, gy, mag }
}

function bilinearSample(field, width, height, x, y) {
  const cx = Math.max(0, Math.min(width - 1.001, x))
  const cy = Math.max(0, Math.min(height - 1.001, y))
  const x0 = Math.floor(cx), y0 = Math.floor(cy)
  const x1 = x0 + 1, y1 = y0 + 1
  const wx = cx - x0, wy = cy - y0
  const v00 = field[y0 * width + x0]
  const v01 = field[y0 * width + x1]
  const v10 = field[y1 * width + x0]
  const v11 = field[y1 * width + x1]
  const top = v00 + (v01 - v00) * wx
  const bottom = v10 + (v11 - v10) * wx
  return top + (bottom - top) * wy
}

function nonMaxSuppress(mag, gx, gy, width, height) {
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const m = mag[idx]
      if (m === 0) continue
      const ux = gx[idx] / m
      const uy = gy[idx] / m
      const ahead = bilinearSample(mag, width, height, x + ux, y + uy)
      const behind = bilinearSample(mag, width, height, x - ux, y - uy)
      if (m >= ahead && m >= behind) out[idx] = m
    }
  }
  return out
}

function estimateGridPitch(nnDistances) {
  const finite = nnDistances.filter((d) => Number.isFinite(d)).sort((a, b) => a - b)
  if (finite.length === 0) return null

  const median = finite[Math.floor(finite.length / 2)]
  const bucketSize = Math.max(1.5, median * 0.2)

  const counts = new Map()
  for (const d of finite) {
    const key = Math.round(d / bucketSize)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  let bestKey = null
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      bestKey = key
    }
  }
  return bestKey === null ? null : bestKey * bucketSize
}

function nearestNeighborDistances(circles) {
  return circles.map((c, i) => {
    let best = Infinity
    for (let j = 0; j < circles.length; j += 1) {
      if (j === i) continue
      const dx = c.cx - circles[j].cx
      const dy = c.cy - circles[j].cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < best) best = d
    }
    return best
  })
}

const MIN_DISC_BRIGHTNESS = 45
// Printed ink creates a far deeper, harder local intensity dip in the CLAHE-equalized
// image than a bump's own shading ever does - a bump's darkest shadow pixel still
// stays well above this floor because that shading is a soft gradient, not a hard
// mark. This catches candidates whose Hough vote was actually generated by nearby
// text (e.g. a corner or crossbar) rather than a real dot, before the shape filters
// below run, since a corner's local ring/profile signature can otherwise look
// convincing enough to pass them too.
function filterOutInk(circles, equalized, width, height) {
  return circles.filter((circle) => {
    const r = Math.round(circle.r)
    let min = 255
    for (let dy = -r; dy <= r; dy += 1) {
      const yy = Math.max(0, Math.min(height - 1, Math.round(circle.cy + dy)))
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx * dx + dy * dy > r * r) continue
        const xx = Math.max(0, Math.min(width - 1, Math.round(circle.cx + dx)))
        const v = equalized[yy * width + xx]
        if (v < min) min = v
      }
    }
    return min >= MIN_DISC_BRIGHTNESS
  })
}

const MIN_CANDIDATES_FOR_RADIUS_FILTER = 4
const RADIUS_MODE_TOLERANCE = 0.35

function filterToRadiusMode(circles) {
  if (circles.length < MIN_CANDIDATES_FOR_RADIUS_FILTER) return circles

  const radii = circles.map((c) => c.r).sort((a, b) => a - b)
  const median = radii[Math.floor(radii.length / 2)]
  const bucketSize = Math.max(1, median * 0.25)

  const weights = new Map()
  for (const c of circles) {
    const key = Math.round(c.r / bucketSize)
    weights.set(key, (weights.get(key) || 0) + c.score)
  }
  let bestKey = null
  let bestWeight = 0
  for (const [key, weight] of weights) {
    if (weight > bestWeight) {
      bestWeight = weight
      bestKey = key
    }
  }
  if (bestKey === null) return circles
  const modeRadius = bestKey * bucketSize

  const kept = circles.filter((c) => Math.abs(c.r - modeRadius) <= modeRadius * RADIUS_MODE_TOLERANCE)
  return kept.length > 0 ? kept : circles
}

const MIN_CANDIDATES_FOR_GRID_FILTER = 6
const GRID_PITCH_TOLERANCE = 0.25
// Includes diagonal lattice distances (sqrt(2), sqrt(5), 2*sqrt(2)) in addition to
// straight multiples, since a dot's nearest neighbor in a 2D grid is often diagonal
// rather than axis-aligned — omitting these caused whole clusters of valid dots to
// be rejected whenever their nearest neighbor happened to be diagonal.
const GRID_PITCH_MULTIPLES = [1, Math.SQRT2, 2, Math.sqrt(5), 2 * Math.SQRT2, 3]

function filterToGrid(circles) {
  if (circles.length < MIN_CANDIDATES_FOR_GRID_FILTER) return circles

  const nn = nearestNeighborDistances(circles)
  const pitch = estimateGridPitch(nn)
  if (!pitch) return circles

  const kept = circles.filter((circle, i) => {
    for (const k of GRID_PITCH_MULTIPLES) {
      const target = pitch * k
      if (Math.abs(nn[i] - target) <= target * GRID_PITCH_TOLERANCE) return true
    }
    return false
  })

  return kept.length > 0 ? kept : circles
}

const PROFILE_RADIUS_BINS = 5
const PROFILE_ANGLE_SAMPLES = 16
const PROFILE_MAX_RADIUS_MULTIPLE = 1.3

function sampleRadialProfile(relative, width, height, cx, cy, r) {
  const profile = new Float32Array(PROFILE_RADIUS_BINS)
  for (let bin = 0; bin < PROFILE_RADIUS_BINS; bin += 1) {
    const frac = (bin + 0.5) / PROFILE_RADIUS_BINS
    const sampleR = frac * r * PROFILE_MAX_RADIUS_MULTIPLE
    let sum = 0
    for (let a = 0; a < PROFILE_ANGLE_SAMPLES; a += 1) {
      const theta = (a / PROFILE_ANGLE_SAMPLES) * Math.PI * 2
      const sx = cx + Math.cos(theta) * sampleR
      const sy = cy + Math.sin(theta) * sampleR
      sum += bilinearSample(relative, width, height, sx, sy)
    }
    profile[bin] = sum / PROFILE_ANGLE_SAMPLES
  }
  return profile
}

function normalizeProfileShape(profile) {
  let mean = 0
  for (let i = 0; i < profile.length; i += 1) mean += profile[i]
  mean /= profile.length

  const centered = new Float32Array(profile.length)
  let normSq = 0
  for (let i = 0; i < profile.length; i += 1) {
    centered[i] = profile[i] - mean
    normSq += centered[i] * centered[i]
  }
  const norm = Math.sqrt(normSq)
  if (norm < 1e-6) return null
  for (let i = 0; i < centered.length; i += 1) centered[i] /= norm
  return centered
}

function dot(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i]
  return sum
}

const MIN_CANDIDATES_FOR_PROFILE_FILTER = 4
const PROFILE_SIMILARITY_THRESHOLD = 0.05

function filterByLightProfile(circles, relative, width, height) {
  if (circles.length < MIN_CANDIDATES_FOR_PROFILE_FILTER) return circles

  const profiles = circles.map((c) =>
    normalizeProfileShape(sampleRadialProfile(relative, width, height, c.cx, c.cy, c.r))
  )

  const template = new Float32Array(PROFILE_RADIUS_BINS)
  let counted = 0
  for (const p of profiles) {
    if (!p) continue
    for (let i = 0; i < PROFILE_RADIUS_BINS; i += 1) template[i] += p[i]
    counted += 1
  }
  if (counted < MIN_CANDIDATES_FOR_PROFILE_FILTER) return circles

  let templateNormSq = 0
  for (let i = 0; i < PROFILE_RADIUS_BINS; i += 1) templateNormSq += template[i] * template[i]
  if (templateNormSq < 1e-6) return circles
  const templateNorm = Math.sqrt(templateNormSq)
  for (let i = 0; i < PROFILE_RADIUS_BINS; i += 1) template[i] /= templateNorm

  // A droplet's radial brightness gradient can legitimately run either direction -
  // bright center fading to a dark rim, or the reverse - depending on lighting angle
  // and surface curvature. Comparing only against +template rejected real droplets
  // whenever their polarity happened to be the minority in a given frame, so both
  // polarities of the template are accepted here.
  const kept = circles.filter((circle, i) => {
    const p = profiles[i]
    if (!p) return false
    const sim = dot(p, template)
    return Math.abs(sim) >= PROFILE_SIMILARITY_THRESHOLD
  })

  return kept.length > 0 ? kept : circles
}

function longestCircularRun(mask, numSectors) {
  if (mask === 0) return 0
  let maxRun = 0
  let current = 0
  for (let i = 0; i < numSectors * 2; i += 1) {
    const bit = (mask >> (i % numSectors)) & 1
    if (bit) {
      current += 1
      if (current > maxRun) maxRun = current
    } else {
      current = 0
    }
  }
  return Math.min(maxRun, numSectors)
}

function houghCircleVote(mag, gx, gy, width, height, { minRadius, maxRadius, dp, edgeThreshold }) {
  const accW = Math.max(1, Math.round(width / dp))
  const accH = Math.max(1, Math.round(height / dp))
  const radii = []
  for (let r = minRadius; r <= maxRadius; r += 1) radii.push(r)
  const numR = radii.length

  const acc = new Uint32Array(accW * accH * numR)
  const angleMask = new Uint32Array(accW * accH * numR)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const m = mag[idx]
      if (m < edgeThreshold) continue
      const ux = gx[idx] / m
      const uy = gy[idx] / m

      for (let ri = 0; ri < numR; ri += 1) {
        const r = radii[ri]
        for (let sign = -1; sign <= 1; sign += 2) {
          const cx = x + sign * ux * r
          const cy = y + sign * uy * r
          const ax = Math.round(cx / dp)
          const ay = Math.round(cy / dp)
          if (ax < 0 || ax >= accW || ay < 0 || ay >= accH) continue
          const bin = (ay * accW + ax) * numR + ri
          acc[bin] += 1
          // Direction from the candidate center back out to this edge pixel -
          // used later to check the support forms one contiguous arc.
          const angle = Math.atan2(-sign * uy, -sign * ux)
          const sector = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * ARC_SECTORS) % ARC_SECTORS
          angleMask[bin] |= 1 << sector
        }
      }
    }
  }

  const pooled = new Uint32Array(accW * accH * numR)
  const pooledMask = new Uint32Array(accW * accH * numR)
  for (let ay = 0; ay < accH; ay += 1) {
    for (let ax = 0; ax < accW; ax += 1) {
      const base = (ay * accW + ax) * numR
      for (let ny = Math.max(0, ay - 1); ny <= Math.min(accH - 1, ay + 1); ny += 1) {
        for (let nx = Math.max(0, ax - 1); nx <= Math.min(accW - 1, ax + 1); nx += 1) {
          const nbase = (ny * accW + nx) * numR
          for (let ri = 0; ri < numR; ri += 1) {
            pooled[base + ri] += acc[nbase + ri]
            pooledMask[base + ri] |= angleMask[nbase + ri]
          }
        }
      }
    }
  }

  const bestCount = new Float32Array(accW * accH)
  const bestFraction = new Float32Array(accW * accH)
  const bestRadius = new Float32Array(accW * accH)
  const bestArc = new Float32Array(accW * accH)
  for (let cell = 0; cell < accW * accH; cell += 1) {
    let best = 0
    let bestR = minRadius
    let bestFrac = 0
    let bestArcVal = 0
    const base = cell * numR
    for (let ri = 0; ri < numR; ri += 1) {
      const count = pooled[base + ri]
      if (count < MIN_RING_VOTES_ABSOLUTE) continue
      const r = radii[ri]
      const fraction = count / (2 * Math.PI * r)
      if (fraction < MIN_RING_SUPPORT) continue
      const arc = longestCircularRun(pooledMask[base + ri], ARC_SECTORS)
      if (arc < MIN_ARC_SECTORS) continue
      if (count > best) {
        best = count
        bestR = r
        bestFrac = fraction
        bestArcVal = arc
      }
    }
    bestCount[cell] = best
    bestFraction[cell] = bestFrac
    bestRadius[cell] = bestR
    bestArc[cell] = bestArcVal
  }

  return { accW, accH, bestCount, bestFraction, bestRadius, bestArc }
}

function findCircleCenters(bestCount, bestFraction, bestRadius, bestArc, accW, accH, dp, { minDist }) {
  const candidates = []
  for (let ay = 0; ay < accH; ay += 1) {
    for (let ax = 0; ax < accW; ax += 1) {
      const count = bestCount[ay * accW + ax]
      if (count <= 0) continue
      candidates.push({ ax, ay, count, fraction: bestFraction[ay * accW + ax], r: bestRadius[ay * accW + ax], arc: bestArc[ay * accW + ax] })
    }
  }
  candidates.sort((a, b) => b.count - a.count)

  const accepted = []
  const minDistSq = minDist * minDist
  for (const candidate of candidates) {
    const cx = candidate.ax * dp
    const cy = candidate.ay * dp
    let tooClose = false
    for (const kept of accepted) {
      const dx = kept.cx - cx
      const dy = kept.cy - cy
      if (dx * dx + dy * dy < minDistSq) {
        tooClose = true
        break
      }
    }
    if (!tooClose) accepted.push({ cx, cy, r: candidate.r, score: candidate.count, arc: candidate.arc })
  }
  return accepted
}

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

export function detectCrescentCircles(imageData) {
  const { data, width, height } = imageData
  const gray = toGrayscale(data, width, height)
  const short = Math.min(width, height)

  const minRadius = Math.max(3, Math.round(short * MIN_RADIUS_FRACTION))
  const maxRadius = Math.max(minRadius + 2, Math.round(short * MAX_RADIUS_FRACTION))

  const tilesX = Math.max(3, Math.round(width / (CLAHE_TILE_RADIUS_MULTIPLE * maxRadius)))
  const tilesY = Math.max(3, Math.round(height / (CLAHE_TILE_RADIUS_MULTIPLE * maxRadius)))
  const equalized = clahe(gray, width, height, tilesX, tilesY, CLAHE_CLIP_LIMIT)
  const relative = localRelativeBrightness(
    equalized,
    width,
    height,
    maxRadius * LOCAL_BRIGHTNESS_SIGMA_RADIUS_MULTIPLE
  )
  const blurred = gaussianBlur(relative, width, height, GRADIENT_BLUR_SIGMA)

  const { gx, gy, mag } = sobelGradient(blurred, width, height)
  const edgeThreshold = otsuThreshold(stretchContrast(mag))
  let magMax = 0
  for (let i = 0; i < mag.length; i += 1) if (mag[i] > magMax) magMax = mag[i]
  const scaledEdgeThreshold = magMax > 0 ? (edgeThreshold / 255) * magMax : 0
  const thinned = nonMaxSuppress(mag, gx, gy, width, height)

  const dp = Math.min(MAX_ACCUMULATOR_DP, Math.max(MIN_ACCUMULATOR_DP, ACCUMULATOR_DP_RADIUS_CONSTANT / maxRadius))
  const { accW, accH, bestCount, bestFraction, bestRadius, bestArc } = houghCircleVote(thinned, gx, gy, width, height, {
    minRadius,
    maxRadius,
    dp,
    edgeThreshold: scaledEdgeThreshold,
  })

  const circles = findCircleCenters(bestCount, bestFraction, bestRadius, bestArc, accW, accH, dp, {
    minDist: maxRadius * MIN_DIST_RADIUS_MULTIPLE,
  })

  const inkFiltered = filterOutInk(circles, equalized, width, height)
  const shapeFiltered = filterToGrid(filterToRadiusMode(inkFiltered))
  const lightFiltered = filterByLightProfile(shapeFiltered, relative, width, height)
  return lightFiltered.map(({ cx, cy, r }) => ({ cx, cy, r }))
}
