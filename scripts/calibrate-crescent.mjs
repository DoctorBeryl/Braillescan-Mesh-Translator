import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import { detectCrescentCircles } from '../src/lib/crescentDetect.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const IN_DIR = join(ROOT, 'test_images', 'input')
const OUT_DIR = join(ROOT, 'test_images', 'output')
const MAX_DETECT_DIMENSION = 260

mkdirSync(OUT_DIR, { recursive: true })

function bilinearResize(src, srcW, srcH, dstW, dstH) {
  const dst = new Uint8ClampedArray(dstW * dstH * 4)
  const xRatio = srcW / dstW
  const yRatio = srcH / dstH
  for (let y = 0; y < dstH; y += 1) {
    const sy = (y + 0.5) * yRatio - 0.5
    const y0 = Math.max(0, Math.min(srcH - 1, Math.floor(sy)))
    const y1 = Math.max(0, Math.min(srcH - 1, y0 + 1))
    const wy = Math.max(0, Math.min(1, sy - y0))
    for (let x = 0; x < dstW; x += 1) {
      const sx = (x + 0.5) * xRatio - 0.5
      const x0 = Math.max(0, Math.min(srcW - 1, Math.floor(sx)))
      const x1 = Math.max(0, Math.min(srcW - 1, x0 + 1))
      const wx = Math.max(0, Math.min(1, sx - x0))

      const i00 = (y0 * srcW + x0) * 4
      const i01 = (y0 * srcW + x1) * 4
      const i10 = (y1 * srcW + x0) * 4
      const i11 = (y1 * srcW + x1) * 4
      const o = (y * dstW + x) * 4
      for (let c = 0; c < 4; c += 1) {
        const top = src[i00 + c] + (src[i01 + c] - src[i00 + c]) * wx
        const bottom = src[i10 + c] + (src[i11 + c] - src[i10 + c]) * wx
        dst[o + c] = top + (bottom - top) * wy
      }
    }
  }
  return dst
}

function drawFilledCircle(data, width, height, cx, cy, radius, [r, g, b]) {
  const minX = Math.max(0, Math.floor(cx - radius))
  const maxX = Math.min(width - 1, Math.ceil(cx + radius))
  const minY = Math.max(0, Math.floor(cy - radius))
  const maxY = Math.min(height - 1, Math.ceil(cy + radius))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= radius * radius) {
        const idx = (y * width + x) * 4
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
      }
    }
  }
}

const files = readdirSync(IN_DIR).filter((f) => /\.(jpe?g)$/i.test(f))
for (const fname of files) {
  const buf = readFileSync(join(IN_DIR, fname))
  const raw = jpeg.decode(buf, { useTArray: true })
  const { width, height, data } = raw

  const scale = Math.min(1, MAX_DETECT_DIMENSION / Math.max(width, height))
  const detW = Math.max(1, Math.round(width * scale))
  const detH = Math.max(1, Math.round(height * scale))
  const detData = scale === 1 ? data : bilinearResize(data, width, height, detW, detH)

  const circles = detectCrescentCircles({ data: detData, width: detW, height: detH })

  const scaleX = width / detW
  const scaleY = height / detH
  const markerRadius = Math.max(2, Math.round(Math.min(width, height) * 0.008))
  const out = Uint8ClampedArray.from(data)
  for (const { cx, cy } of circles) {
    drawFilledCircle(out, width, height, cx * scaleX, cy * scaleY, markerRadius, [34, 197, 94])
  }

  const encoded = jpeg.encode({ data: out, width, height }, 92)
  writeFileSync(join(OUT_DIR, fname), encoded.data)
  console.log(`${fname}: ${circles.length} dot(s) detected (detect res ${detW}x${detH})`)
}
