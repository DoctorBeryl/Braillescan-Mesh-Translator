
export const SHARPNESS_THRESHOLD = 100
export const SHARPNESS_REFERENCE_VARIANCE = SHARPNESS_THRESHOLD * 2
export const SHARPNESS_SAMPLE_WIDTH = 160
export const SHARPNESS_SAMPLE_HEIGHT = 120

export function laplacianVariance(data, width, height) {
  const gray = new Float32Array(width * height)
  let min = 255
  let max = 0
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    gray[p] = g
    if (g < min) min = g
    if (g > max) max = g
  }

  const range = max - min
  if (range > 1) {
    const scale = 255 / range
    for (let p = 0; p < gray.length; p += 1) {
      gray[p] = (gray[p] - min) * scale
    }
  }

  let sum = 0
  let sumSq = 0
  let count = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      const lap = gray[idx - width] + gray[idx + width] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]
      sum += lap
      sumSq += lap * lap
      count += 1
    }
  }
  if (count === 0) return 0
  const mean = sum / count
  return sumSq / count - mean * mean
}

export function sampleImageData(source, canvas) {
  canvas.width = SHARPNESS_SAMPLE_WIDTH
  canvas.height = SHARPNESS_SAMPLE_HEIGHT
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function computeSharpness(imageData) {
  const variance = laplacianVariance(imageData.data, imageData.width, imageData.height)
  const sharpnessPercent = Math.max(0, Math.min(100, Math.round((variance / SHARPNESS_REFERENCE_VARIANCE) * 100)))
  const blurry = variance < SHARPNESS_THRESHOLD
  return { sharpness: Math.round(variance * 10) / 10, sharpnessPercent, blurry }
}
