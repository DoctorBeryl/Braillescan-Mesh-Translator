import { useState } from 'react'
import { Camera } from 'lucide-react'

const STREAM_URL = '/api/camera/stream'

function CameraStream({ tone, themePalette, checked, available, onStreamingChange }) {
  const [streaming, setStreaming] = useState(false)
  const [streamError, setStreamError] = useState('')
  const [streamKey, setStreamKey] = useState(0)

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

  const handleStreamError = () => {
    setStreamingState(false)
    setStreamError('Lost connection to the camera stream.')
  }

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
          className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${streaming ? 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-400' : tone.button}`}
        >
          {streaming ? 'Live' : 'Idle'}
        </button>
      </div>

      <div className={`flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed ${themePalette.outline}`}>
        {streaming ? (
          <img
            key={streamKey}
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
