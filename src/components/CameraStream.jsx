import { useEffect, useRef, useState } from 'react'
import { Camera, Play } from 'lucide-react'
import { computeSharpness, sampleImageData } from '../lib/sharpness'

const STREAM_URL = '/api/camera/stream'
const SHARPNESS_INTERVAL_MS = 1000

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

  useEffect(() => {
    if (syncedFromServer.current || serverStreaming == null) return
    syncedFromServer.current = true
    if (serverStreaming && !streaming) {
      setStreamError('')
      setStreamKey((value) => value + 1)
      setStreamingState(true)
    }
  }, [serverStreaming])

  const handleStreamError = () => {
    setStreamingState(false)
    setStreamError('Lost connection to the camera stream.')
  }

  const onSharpnessRef = useRef(onSharpness)
  useEffect(() => {
    onSharpnessRef.current = onSharpness
  }, [onSharpness])

  useEffect(() => {
    if (!streaming) return

    const canvas = document.createElement('canvas')

    const analyze = () => {
      const img = imgRef.current
      if (!img || !img.naturalWidth) return

      let report
      try {
        report = computeSharpness(sampleImageData(img, canvas))
      } catch {
        return
      }

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
