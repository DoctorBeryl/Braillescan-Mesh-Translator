import { useEffect, useRef, useState } from 'react'
import { Camera, Play } from 'lucide-react'

const STREAM_URL = '/api/camera/stream'

// Downsampled before analysis -- the Laplacian pass only needs enough
// resolution to judge blur, and running it on the full 640x480 frame every
// second would be wasted work for the same result.
const SHARPNESS_SAMPLE_WIDTH = 160
const SHARPNESS_SAMPLE_HEIGHT = 120
const SHARPNESS_INTERVAL_MS = 1000

// Same threshold/reference as server/compile.py's SHARPNESS_THRESHOLD (100)
// and server/sharpness.py's old SHARPNESS_REFERENCE_VARIANCE (threshold*2) --
// kept in sync by hand so the web UI, the (removed) Pi-side check, and the
// stitching pipeline all called the same image "blurry".
const SHARPNESS_THRESHOLD = 100
const SHARPNESS_REFERENCE_VARIANCE = SHARPNESS_THRESHOLD * 2

// Laplacian-variance blur metric: convolve a 3x3 Laplacian kernel over the
// grayscale frame and take the variance of the result -- a sharp image has
// high-frequency edges everywhere (high variance), a blurry one doesn't.
// This is the same measure cv2.Laplacian(...).var() gives, just computed by
// hand since there's no OpenCV in the browser.
function laplacianVariance(data, width, height) {
  const gray = new Float32Array(width * height)
  let min = 255
  let max = 0
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    gray[p] = g
    if (g < min) min = g
    if (g > max) max = g
  }

  // Laplacian variance scales with contrast as well as focus, so a
  // washed-out/flatly-lit frame (embossed dots under soft light, close in
  // tone to the background) reads as "blurry" even in perfect focus.
  // Stretching the sampled patch to fill the full 0-255 range before
  // measuring edges compensates for that, so this only measures focus.
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

function CameraStream({ tone, themePalette, checked, available, onStreamingChange, onSharpness, serverStreaming }) {
  const [streaming, setStreaming] = useState(false)
  const [streamError, setStreamError] = useState('')
  const [streamKey, setStreamKey] = useState(0)
  const syncedFromServer = useRef(false)
  const imgRef = useRef(null)

  const setStreamingState = (value) => {
    setStreaming(value)
    onStreamingChange?.(value)
  }

  const toggleStream = () => {
    if (streaming) {
      setStreamingState(false)
      return
    }
    setStreamError('')
    setStreamKey((value) => value + 1)
    setStreamingState(true)
  }

  // The Pi is the source of truth for whether the camera is actually
  // live (it's the one holding the rpicam-vid process). Reconcile once
  // against that on the first real /api/camera/stats response -- e.g. a
  // page reload should show "Live" immediately if the camera was already
  // streaming, rather than defaulting to idle until someone re-toggles it.
  // Only the initial sync auto-drives the toggle; afterwards the button and
  // stream errors are what update `streaming`, so this doesn't fight a
  // manual toggle click against a stale poll response.
  useEffect(() => {
    if (syncedFromServer.current || serverStreaming == null) return
    syncedFromServer.current = true
    if (serverStreaming && !streaming) {
      setStreamError('')
      setStreamKey((value) => value + 1)
      setStreamingState(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverStreaming])

  const handleStreamError = () => {
    setStreamingState(false)
    setStreamError('Lost connection to the camera stream.')
  }

  // App re-renders roughly every 500ms while streaming (distance polling),
  // which would recreate an inline onSharpness prop each time -- kept in a
  // ref so the analysis effect below can depend on `streaming` alone instead
  // of tearing down and rebuilding its interval on every parent render.
  const onSharpnessRef = useRef(onSharpness)
  useEffect(() => {
    onSharpnessRef.current = onSharpness
  }, [onSharpness])

  // Computes blur/sharpness on the client (see laplacianVariance above)
  // instead of asking the Pi to run cv2 on its own CPU, then reports it to
  // the server so lcd.py's display and the rest of the web UI can both read
  // it back from /api/sharpness.
  useEffect(() => {
    if (!streaming) return

    const canvas = document.createElement('canvas')
    canvas.width = SHARPNESS_SAMPLE_WIDTH
    canvas.height = SHARPNESS_SAMPLE_HEIGHT
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const analyze = () => {
      const img = imgRef.current
      if (!ctx || !img || !img.naturalWidth) return

      let variance
      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        variance = laplacianVariance(data, canvas.width, canvas.height)
      } catch {
        return
      }

      const sharpnessPercent = Math.max(0, Math.min(100, Math.round((variance / SHARPNESS_REFERENCE_VARIANCE) * 100)))
      const blurry = variance < SHARPNESS_THRESHOLD
      const report = { sharpness: Math.round(variance * 10) / 10, sharpnessPercent, blurry }

      onSharpnessRef.current?.(report)
      fetch('/api/sharpness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      }).catch(() => {})
    }

    analyze()
    const interval = setInterval(analyze, SHARPNESS_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [streaming])

  return (
    <div className={`rounded-2xl border p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.18)] ${tone.strong} ${themePalette.card}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.button}`}>
            <Camera className="h-4.5 w-4.5" strokeWidth={2.25} />
          </div>
          <div>
            <p className={`text-[10px] uppercase ${themePalette.muted}`}>Camera</p>
            <h3 className={`font-medium ${themePalette.text}`}>Module 3</h3>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleStream}
          disabled={!checked || !available}
          aria-pressed={streaming}
          title={streaming ? 'Stop the live camera stream' : 'Start the live camera stream'}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            streaming
              ? 'border-red-400/40 bg-red-500/15 text-red-400 hover:bg-red-500/25'
              : `border-transparent ${tone.button} hover:brightness-110`
          }`}
        >
          {streaming ? (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              Stop stream
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" strokeWidth={2.25} fill="currentColor" />
              Go live
            </>
          )}
        </button>
      </div>

      <div className={`flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed ${themePalette.outline}`}>
        {streaming ? (
          <img
            key={streamKey}
            ref={imgRef}
            src={STREAM_URL}
            alt="Live camera feed"
            className="h-full w-full object-cover"
            onError={handleStreamError}
          />
        ) : (
          <p className={`text-sm ${themePalette.secondary}`}>
            {!checked
              ? 'Checking for a camera…'
              : !available
                ? 'No camera detected on this device.'
                : streamError || 'Streaming off'}
          </p>
        )}
      </div>
    </div>
  )
}

export default CameraStream
