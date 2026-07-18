import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, Lock, RefreshCw, Wifi, X } from 'lucide-react'

const API_BASE = '/api/wifi'

function WifiPanel({ open, onClose, theme, themePalette, tone }) {
  const [ifaceChecked, setIfaceChecked] = useState(false)
  const [ifaceExists, setIfaceExists] = useState(false)
  const [networks, setNetworks] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [selected, setSelected] = useState(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectResult, setConnectResult] = useState(null)

  const scanNetworks = async () => {
    setScanning(true)
    setScanError('')
    try {
      const response = await fetch(`${API_BASE}/networks`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Scan failed.')
      setNetworks(data.networks || [])
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    if (!open) return

    setIfaceChecked(false)
    setSelected(null)
    setConnectResult(null)

    let cancelled = false

    fetch(`${API_BASE}/interface`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        setIfaceExists(Boolean(data.exists))
        setIfaceChecked(true)
        if (data.exists) scanNetworks()
      })
      .catch(() => {
        if (cancelled) return
        setIfaceExists(false)
        setIfaceChecked(true)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectNetwork = (network) => {
    setSelected(network)
    setPassword('')
    setShowPassword(false)
    setConnectResult(null)
  }

  const connect = async (event) => {
    event.preventDefault()
    if (!selected) return

    setConnecting(true)
    setConnectResult(null)
    try {
      const response = await fetch(`${API_BASE}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: selected.ssid,
          password: selected.secure ? password : undefined,
        }),
      })
      const data = await response.json()
      setConnectResult({ success: Boolean(data.success), message: data.message || '' })
    } catch (err) {
      setConnectResult({ success: false, message: err.message })
    } finally {
      setConnecting(false)
    }
  }

  if (!open) return null

  const inputTone = theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl ${themePalette.surface}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b px-4 py-3 ${themePalette.border}`}>
          <div className="flex items-center gap-2">
            <Wifi className="h-4.5 w-4.5" strokeWidth={2.25} />
            <p className={`text-sm font-semibold ${themePalette.text}`}>Wi-Fi</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition ${themePalette.chip}`}
            aria-label="Close Wi-Fi panel"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {!ifaceChecked && (
            <p className={`text-sm ${themePalette.secondary}`}>Checking for a Wi-Fi adapter…</p>
          )}

          {ifaceChecked && !ifaceExists && (
            <p className={`text-sm ${themePalette.secondary}`}>
              No secondary Wi-Fi adapter (wlan1) was detected on this device.
            </p>
          )}

          {ifaceChecked && ifaceExists && !selected && (
            <>
              <div className="flex items-center justify-between">
                <p className={`text-xs uppercase tracking-wide ${themePalette.muted}`}>Available networks</p>
                <button
                  type="button"
                  onClick={scanNetworks}
                  disabled={scanning}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${tone.button} disabled:opacity-60`}
                >
                  <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} strokeWidth={2.25} />
                  {scanning ? 'Scanning' : 'Rescan'}
                </button>
              </div>

              {scanError && <p className="text-sm text-red-400">{scanError}</p>}

              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {networks.map((network) => (
                  <button
                    key={network.ssid}
                    type="button"
                    onClick={() => selectNetwork(network)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${themePalette.outline} ${themePalette.text} hover:bg-white/5`}
                  >
                    <span className="flex items-center gap-2">
                      {network.secure && <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />}
                      {network.ssid}
                      {network.connected && (
                        <span className={`text-xs ${themePalette.muted}`}>(connected)</span>
                      )}
                    </span>
                    <span className={`text-xs ${themePalette.muted}`}>{network.signal}%</span>
                  </button>
                ))}
                {!scanning && networks.length === 0 && !scanError && (
                  <p className={`text-sm ${themePalette.secondary}`}>No networks found yet.</p>
                )}
              </div>
            </>
          )}

          {selected && (
            <form className="space-y-3" onSubmit={connect}>
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${themePalette.text}`}>{selected.ssid}</p>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className={`cursor-pointer text-xs ${themePalette.muted} hover:underline`}
                >
                  Back
                </button>
              </div>

              {selected.secure ? (
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    minLength={8}
                    maxLength={63}
                    required
                    autoComplete="off"
                    className={`w-full rounded-xl border px-3 py-2 pr-10 text-sm outline-none ${themePalette.outline} ${inputTone}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer ${themePalette.muted}`}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={2.25} /> : <Eye className="h-4 w-4" strokeWidth={2.25} />}
                  </button>
                </div>
              ) : (
                <p className={`text-sm ${themePalette.secondary}`}>
                  This network is open and does not require a password.
                </p>
              )}

              <button
                type="submit"
                disabled={connecting}
                className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${tone.button} disabled:opacity-60`}
              >
                {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />}
                {connecting ? 'Connecting…' : 'Connect'}
              </button>

              {connectResult && (
                <p className={`text-sm ${connectResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {connectResult.success ? 'Connected successfully.' : connectResult.message || 'Failed to connect.'}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default WifiPanel
