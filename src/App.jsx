import { useEffect, useRef, useState } from 'react'
import { Activity, Aperture, Box, Bug, Clock, Cpu, Crosshair, Download, ExternalLink, Focus, Gauge, HardDrive, Home as HomeIcon, Image as ImageIcon, KeyRound, Languages as LanguagesIcon, Loader2, LogIn, LogOut, Lock, Moon, Palette, Settings, ShieldCheck, Sun, Terminal, Type, Video, Wifi, X } from 'lucide-react'
import WifiPanel from './components/WifiPanel'
import CameraStream from './components/CameraStream'

const tabs = [
  { name: 'Home' },
  { name: 'Livestream' },
  { name: '3D View' },
  { name: 'Translation' },
  { name: 'Debug' },
]
const tabIcons = {
  Home: HomeIcon,
  Livestream: Video,
  '3D View': Box,
  Translation: LanguagesIcon,
  Debug: Bug,
}
const tabDescriptions = {
  Livestream: 'Watch the live camera feed.',
  '3D View': 'Explore the reconstructed model in 3D.',
  Translation: 'Switch output language and translation behavior.',
  Debug: 'Review live diagnostics and rolling entries.',
}
const headerCaptions = {
  Home: 'Camera · 3D · translation hub',
  Livestream: 'Live camera feed',
  '3D View': '3D reconstruction viewer',
  Translation: 'Real-time translation',
  Debug: 'System diagnostics',
}
const translationSampleText = 'Hello, welcome to the Pi Translator.'
const idealFocalDistanceCm = 30
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'password'
const fallbackSystemCommands = [
  { id: 'reboot', label: 'Reboot device' },
  { id: 'poweroff', label: 'Power off device' },
  { id: 'restart-network', label: 'Restart Wi-Fi interface' },
  { id: 'disk-usage', label: 'Check disk usage' },
]
const fallbackLanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'ja', name: 'Japanese' },
]
function formatUptime(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return 'Unavailable'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return 'Unavailable'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}

function App() {
  const [activeTab, setActiveTab] = useState('Home')
  const [languages, setLanguages] = useState(fallbackLanguages)
  const [targetLang, setTargetLang] = useState('en')
  const [showTranslation, setShowTranslation] = useState(true)
  const [translatedText, setTranslatedText] = useState('')
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState('')
  const [compileProgress, setCompileProgress] = useState(42)
  const [modelExported, setModelExported] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
  const [theme, setTheme] = useState('dark')
  const [textPercent, setTextPercent] = useState(100)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [wifiOpen, setWifiOpen] = useState(false)
  const [cameraChecked, setCameraChecked] = useState(false)
  const [cameraAvailable, setCameraAvailable] = useState(false)
  const [cameraStreaming, setCameraStreaming] = useState(false)
  const [wifiStatus, setWifiStatus] = useState({ checked: false, connected: false, ssid: null, signal: null })
  const [latencyMs, setLatencyMs] = useState(null)
  const [storedImages, setStoredImages] = useState(0)
  const [sharpness, setSharpness] = useState(88)
  const [distanceToSurface, setDistanceToSurface] = useState(null)
  const [systemStats, setSystemStats] = useState(null)
  const [cameraStats, setCameraStats] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [systemCommands, setSystemCommands] = useState(fallbackSystemCommands)
  const [selectedCommand, setSelectedCommand] = useState('reboot')
  const [commandRunning, setCommandRunning] = useState(false)
  const [commandResult, setCommandResult] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [compiling, setCompiling] = useState(false)
  const [compileError, setCompileError] = useState('')
  const [imagesPopup, setImagesPopup] = useState(null)
  const settingsRef = useRef(null)
  const modelViewerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/camera/status')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        setCameraAvailable(Boolean(data.available))
        setCameraChecked(true)
      })
      .catch(() => {
        if (cancelled) return
        setCameraAvailable(false)
        setCameraChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const checkWifi = () => {
      fetch('/api/wifi/status')
        .then((response) => response.json())
        .then((data) => {
          if (cancelled) return
          setWifiStatus({ checked: true, connected: Boolean(data.connected), ssid: data.ssid || null, signal: data.signal ?? null })
        })
        .catch(() => {
          if (cancelled) return
          setWifiStatus({ checked: true, connected: false, ssid: null, signal: null })
        })
    }
    checkWifi()
    const interval = setInterval(checkWifi, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const ping = () => {
      const start = performance.now()
      fetch('/api/ping')
        .then((response) => {
          if (!response.ok) throw new Error('unreachable')
          return response.json()
        })
        .then(() => {
          if (cancelled) return
          setLatencyMs(Math.round(performance.now() - start))
        })
        .catch(() => {
          if (cancelled) return
          setLatencyMs(null)
        })
    }
    ping()
    const interval = setInterval(ping, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const poll = () => {
      fetch('/api/system/stats')
        .then((response) => response.json())
        .then((data) => {
          if (!cancelled) setSystemStats(data)
        })
        .catch(() => {
          if (!cancelled) setSystemStats(null)
        })
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const poll = () => {
      fetch('/api/camera/stats')
        .then((response) => response.json())
        .then((data) => {
          if (!cancelled) setCameraStats(data)
        })
        .catch(() => {
          if (!cancelled) setCameraStats(null)
        })
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    fetch('/api/translate/languages')
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.languages) && data.languages.length > 0) {
          setLanguages(data.languages)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/system/commands')
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.commands) && data.commands.length > 0) {
          setSystemCommands(data.commands)
          setSelectedCommand(data.commands[0].id)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!showTranslation) {
      setTranslatedText('')
      setTranslateError('')
      return
    }
    let cancelled = false
    setTranslating(true)
    setTranslateError('')
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: translationSampleText, to: targetLang }),
    })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) throw new Error(data.message || 'Translation failed.')
        setTranslatedText(data.translated || '')
      })
      .catch((err) => {
        if (cancelled) return
        setTranslatedText('')
        setTranslateError(err.message || 'Translation failed.')
      })
      .finally(() => {
        if (!cancelled) setTranslating(false)
      })
    return () => {
      cancelled = true
    }
  }, [targetLang, showTranslation])

  useEffect(() => {
    if (!cameraStreaming) return
    const interval = setInterval(() => {
      setSharpness((value) => {
        const next = value + (Math.random() * 6 - 3)
        return Math.max(58, Math.min(97, Math.round(next)))
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [cameraStreaming])

  useEffect(() => {
    if (!cameraStreaming) return
    let cancelled = false
    const poll = () => {
      fetch('/api/distance')
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (cancelled) return
          setDistanceToSurface(ok && typeof data.distanceCm === 'number' ? Math.round(data.distanceCm) : null)
        })
        .catch(() => {
          if (!cancelled) setDistanceToSurface(null)
        })
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [cameraStreaming])

  useEffect(() => {
    let cancelled = false
    const poll = () => {
      fetch('/api/images/count')
        .then((response) => response.json())
        .then((data) => {
          if (!cancelled) setStoredImages(data.count ?? 0)
        })
        .catch(() => {
          if (!cancelled) setStoredImages(0)
        })
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.fontSize

    root.style.fontSize = `${textPercent}%`

    return () => {
      root.style.fontSize = previous
    }
  }, [textPercent])

  const themePalette = theme === 'dark'
    ? {
        page: 'bg-black',
        shell: 'border-slate-800 bg-black shadow-[0_10px_40px_rgba(0,0,0,0.45)]',
        surface: 'border-slate-800 bg-[#0b0d12]',
        card: 'border-slate-800 bg-[#10131a]',
        text: 'text-slate-100',
        muted: 'text-slate-400',
        secondary: 'text-slate-300',
        accent: 'text-cyan-300',
        chip: 'bg-slate-900 text-slate-200',
        chipActive: 'bg-white text-slate-950',
        tabInactive: 'text-slate-300 hover:bg-slate-800 hover:text-white',
        border: 'border-slate-800',
        outline: 'border-slate-800',
        zebra: 'bg-white/[0.03]',
      }
    : {
        page: 'bg-[linear-gradient(135deg,_#f8fafc_0%,_#eef2f7_100%)]',
        shell: 'border-slate-200 bg-white/95 shadow-[0_10px_40px_rgba(148,163,184,0.18)]',
        surface: 'border-slate-200 bg-slate-50/95',
        card: 'border-slate-200 bg-white/90',
        text: 'text-slate-900',
        muted: 'text-slate-600',
        secondary: 'text-slate-700',
        accent: 'text-sky-700',
        chip: 'bg-slate-100 text-slate-700',
        chipActive: 'bg-slate-900 text-white',
        tabInactive: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        border: 'border-slate-200',
        outline: 'border-slate-200',
        zebra: 'bg-slate-900/[0.025]',
      }

  const activeTone = theme === 'dark'
    ? {
        Home: { button: 'bg-cyan-400/85 text-slate-950 border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(34,211,238,0.16)]', chip: 'bg-cyan-400/15 text-cyan-100 border border-cyan-400/35', soft: 'bg-[#0b1117] border border-cyan-400/30', strong: 'bg-[#11161d] border border-cyan-400/40', text: 'text-cyan-100', dot: 'bg-cyan-300', bar: 'from-transparent via-cyan-400 to-transparent', borderAccent: 'border-l-cyan-400/70', hex: '#67e8f9' },
        Livestream: { button: 'bg-fuchsia-400/85 text-slate-950 border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(217,70,239,0.14)]', chip: 'bg-fuchsia-400/12 text-fuchsia-200 border border-fuchsia-400/25', soft: 'bg-[#121018] border border-fuchsia-400/25', strong: 'bg-[#19141f] border border-fuchsia-400/30', text: 'text-fuchsia-100', dot: 'bg-fuchsia-300', bar: 'from-transparent via-fuchsia-400 to-transparent', borderAccent: 'border-l-fuchsia-400/70', hex: '#f0abfc' },
        '3D View': { button: 'bg-violet-400/85 text-slate-950 border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(139,92,246,0.14)]', chip: 'bg-violet-400/12 text-violet-200 border border-violet-400/25', soft: 'bg-[#0f0917] border border-violet-400/25', strong: 'bg-[#161020] border border-violet-400/30', text: 'text-violet-100', dot: 'bg-violet-300', bar: 'from-transparent via-violet-400 to-transparent', borderAccent: 'border-l-violet-400/70', hex: '#c4b5fd' },
        Translation: { button: 'bg-emerald-400/85 text-slate-950 border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(16,185,129,0.14)]', chip: 'bg-emerald-400/12 text-emerald-200 border border-emerald-400/25', soft: 'bg-[#07140f] border border-emerald-400/25', strong: 'bg-[#0d1b17] border border-emerald-400/30', text: 'text-emerald-100', dot: 'bg-emerald-300', bar: 'from-transparent via-emerald-400 to-transparent', borderAccent: 'border-l-emerald-400/70', hex: '#6ee7b7' },
        Debug: { button: 'bg-amber-300/85 text-slate-950 border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(245,158,11,0.14)]', chip: 'bg-amber-400/12 text-amber-100 border border-amber-400/25', soft: 'bg-[#14110a] border border-amber-400/25', strong: 'bg-[#1b140c] border border-amber-400/30', text: 'text-amber-100', dot: 'bg-amber-300', bar: 'from-transparent via-amber-300 to-transparent', borderAccent: 'border-l-amber-300/70', hex: '#fcd34d' },
      }
    : {
        Home: { button: 'bg-cyan-600/90 text-white border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(14,165,233,0.14)]', chip: 'bg-cyan-100 text-cyan-800 border border-cyan-500/40', soft: 'bg-cyan-100 border border-cyan-500/40', strong: 'bg-cyan-50 border-cyan-500/50', text: 'text-cyan-800', dot: 'bg-cyan-600', bar: 'from-transparent via-cyan-500 to-transparent', borderAccent: 'border-l-cyan-500/70', hex: '#0891b2' },
        Livestream: { button: 'bg-fuchsia-600/90 text-white border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(192,132,252,0.14)]', chip: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-500/40', soft: 'bg-fuchsia-100 border border-fuchsia-500/40', strong: 'bg-fuchsia-50 border-fuchsia-500/50', text: 'text-fuchsia-800', dot: 'bg-fuchsia-600', bar: 'from-transparent via-fuchsia-500 to-transparent', borderAccent: 'border-l-fuchsia-500/70', hex: '#c026d3' },
        '3D View': { button: 'bg-violet-600/90 text-white border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(167,139,250,0.14)]', chip: 'bg-violet-100 text-violet-800 border border-violet-500/40', soft: 'bg-violet-100 border border-violet-500/40', strong: 'bg-violet-50 border-violet-500/50', text: 'text-violet-800', dot: 'bg-violet-600', bar: 'from-transparent via-violet-500 to-transparent', borderAccent: 'border-l-violet-500/70', hex: '#7c3aed' },
        Translation: { button: 'bg-emerald-600/90 text-white border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(52,211,153,0.14)]', chip: 'bg-emerald-100 text-emerald-800 border border-emerald-500/40', soft: 'bg-emerald-100 border border-emerald-500/40', strong: 'bg-emerald-50 border-emerald-500/50', text: 'text-emerald-800', dot: 'bg-emerald-600', bar: 'from-transparent via-emerald-500 to-transparent', borderAccent: 'border-l-emerald-500/70', hex: '#059669' },
        Debug: { button: 'bg-amber-600/90 text-white border border-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.28),0_0_16px_rgba(251,191,36,0.14)]', chip: 'bg-amber-100 text-amber-800 border border-amber-500/40', soft: 'bg-amber-100 border border-amber-500/40', strong: 'bg-amber-50 border-amber-500/50', text: 'text-amber-800', dot: 'bg-amber-600', bar: 'from-transparent via-amber-500 to-transparent', borderAccent: 'border-l-amber-500/70', hex: '#d97706' },
      }

  const tone = activeTone[activeTab] || activeTone.Home
  const accentBorder = theme === 'dark'
    ? 'border-white/10'
    : 'border-slate-200'

  themePalette.shell = `${tone.strong} ${accentBorder} ${theme === 'dark' ? 'bg-black/95' : 'bg-white/95'}`
  themePalette.surface = `${tone.soft} ${accentBorder}`
  themePalette.card = `${tone.strong} ${accentBorder}`
  themePalette.chip = tone.chip
  themePalette.chipActive = tone.button
  themePalette.tabInactive = theme === 'dark' ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  themePalette.border = accentBorder
  themePalette.outline = accentBorder

  const pageGlow = theme === 'dark'
    ? {
        Home: 'bg-black bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.08),_transparent_50%)]',
        Livestream: 'bg-black bg-[radial-gradient(circle_at_top_left,_rgba(217,70,239,0.16),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(217,70,239,0.08),_transparent_50%)]',
        '3D View': 'bg-black bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.16),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(139,92,246,0.08),_transparent_50%)]',
        Translation: 'bg-black bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_50%)]',
        Debug: 'bg-black bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.08),_transparent_50%)]',
      }
    : {
        Home: 'bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_40%)]',
        Livestream: 'bg-[radial-gradient(circle_at_top_left,_rgba(192,132,252,0.18),_transparent_40%)]',
        '3D View': 'bg-[radial-gradient(circle_at_top_left,_rgba(167,139,250,0.18),_transparent_40%)]',
        Translation: 'bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_40%)]',
        Debug: 'bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_40%)]',
      }
  const scaleStyle = { fontSize: `${textPercent}%` }

  const handleCompile = async () => {
    setCompiling(true)
    setCompileError('')
    try {
      const compileResponse = await fetch('/api/compile', { method: 'POST' })
      const compileData = await compileResponse.json()
      if (!compileResponse.ok || !compileData.success) {
        throw new Error(compileData.message || 'Compile failed.')
      }

      const imagesResponse = await fetch('/api/output/images')
      const imagesData = await imagesResponse.json()
      if (!imagesResponse.ok) throw new Error(imagesData.message || 'Failed to load compiled images.')

      setImagesPopup({ images: imagesData.images ?? [] })
      setCompileProgress((value) => Math.min(100, value + 18))
    } catch (err) {
      setCompileError(err.message || 'Compile failed.')
    } finally {
      setCompiling(false)
    }
  }

  const handleExport = async () => {
    const viewer = modelViewerRef.current
    if (!viewer || typeof viewer.exportScene !== 'function') {
      setExportError('The 3D viewer is not ready yet.')
      return
    }

    setExporting(true)
    setExportError('')
    try {
      const blob = await viewer.exportScene({ binary: true })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'pi-translator-model.glb'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setModelExported(true)
    } catch (err) {
      setExportError(err.message || 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  const handleLogin = (event) => {
    event.preventDefault()
    if (authUsername === ADMIN_USERNAME && authPassword === ADMIN_PASSWORD) {
      setAuthenticated(true)
      setAuthError('')
      setAuthPassword('')
    } else {
      setAuthError('Incorrect username or password.')
    }
  }

  const handleLogout = () => {
    setAuthenticated(false)
    setAuthUsername('')
    setAuthPassword('')
    setAuthError('')
    setCommandResult(null)
  }

  const handleRunCommand = async () => {
    if (!authenticated) return
    const entry = systemCommands.find((command) => command.id === selectedCommand)
    if (!entry) return
    if (!window.confirm(`Run "${entry.label}" on the device?`)) return

    setCommandRunning(true)
    setCommandResult(null)
    try {
      const response = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: selectedCommand }),
      })
      const data = await response.json()
      setCommandResult({ success: Boolean(data.success), message: data.output || data.message || '' })
    } catch (err) {
      setCommandResult({ success: false, message: err.message })
    } finally {
      setCommandRunning(false)
    }
  }

  const livestreamContent = (
    <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
      <CameraStream
        tone={tone}
        themePalette={themePalette}
        checked={cameraChecked}
        available={cameraAvailable}
        onStreamingChange={setCameraStreaming}
      />

      <div className={`space-y-2 rounded-2xl border p-3 ${themePalette.card}`}>
        <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
          <div className="flex items-center justify-between">
            <p className={`flex items-center gap-1.5 text-[10px] uppercase ${themePalette.muted}`}>
              <ImageIcon className="h-3 w-3" strokeWidth={2.25} />
              Stored images
            </p>
          </div>
          <p className={`mt-1 text-lg font-semibold ${themePalette.text}`}>{storedImages.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase">
            <p className={`flex items-center gap-1.5 ${themePalette.muted}`}>
              <Gauge className="h-3 w-3" strokeWidth={2.25} />
              Sharpness
            </p>
            <span className={themePalette.text}>{cameraStreaming ? `${sharpness}%` : '—'}</span>
          </div>
          <div className={`h-2 rounded-full ${tone.strong}`}>
            <div className={`h-2 rounded-full ${tone.dot} transition-all`} style={{ width: `${cameraStreaming ? sharpness : 0}%` }} />
          </div>
        </div>
        <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
          <p className={`flex items-center gap-1.5 text-[10px] uppercase ${themePalette.muted}`}>
            <Crosshair className="h-3 w-3" strokeWidth={2.25} />
            Distance to surface
          </p>
          <p className={`mt-1 text-lg font-semibold ${themePalette.text}`}>
            {!cameraStreaming ? '— cm' : distanceToSurface == null ? 'Unavailable' : `${distanceToSurface} cm`}
          </p>
        </div>
        <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
          <p className={`flex items-center gap-1.5 text-[10px] uppercase ${themePalette.muted}`}>
            <Focus className="h-3 w-3" strokeWidth={2.25} />
            Ideal focal distance
          </p>
          <p className={`mt-1 text-lg font-semibold ${themePalette.text}`}>{idealFocalDistanceCm} cm</p>
        </div>
        <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
          <p className={`text-[10px] uppercase ${themePalette.muted}`}>Session</p>
          <p className={`mt-1 text-sm ${themePalette.secondary}`}>
            {cameraStreaming ? 'Streaming session is active right now.' : 'No active streaming session.'}
          </p>
        </div>
      </div>
    </div>
  )

  const renderTabContent = () => {
    if (activeTab === '3D View') {
      return (
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className={`rounded-2xl border p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.18)] ${tone.strong} ${themePalette.card}`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.button}`}>
                  <Box className="h-4.5 w-4.5" strokeWidth={2.25} />
                </div>
                <div>
                  <p className={`text-[10px] uppercase ${themePalette.muted}`}>Preview</p>
                  <h3 className={`font-medium ${themePalette.text}`}>Reconstructed model</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoRotate((value) => !value)}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition ${autoRotate ? tone.button : themePalette.chip}`}
              >
                {autoRotate ? 'Auto-rotate on' : 'Auto-rotate off'}
              </button>
            </div>

            <div className={`min-h-[300px] overflow-hidden rounded-xl border ${themePalette.surface}`}>
              <model-viewer
                ref={modelViewerRef}
                src="/src/assets/braille.glb"
                alt="Reconstructed 3D scan preview"
                camera-controls
                touch-action="pan-y"
                shadow-intensity="1"
                exposure="0.9"
                environment-image="neutral"
                style={{ width: '100%', height: '300px', display: 'block' }}
                {...(autoRotate ? { 'auto-rotate': '', 'rotation-per-second': '18deg' } : {})}
              />
            </div>
          </div>

          <div className={`space-y-2 rounded-2xl border p-3 ${themePalette.card}`}>
            <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
              <p className={`flex items-center gap-1.5 text-[10px] uppercase ${themePalette.muted}`}>
                <ImageIcon className="h-3 w-3" strokeWidth={2.25} />
                Stored images
              </p>
              <p className={`mt-1 text-lg font-semibold ${themePalette.text}`}>{storedImages.toLocaleString()}</p>
            </div>
            <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
              <p className={`text-[10px] uppercase ${themePalette.muted}`}>Compile</p>
              <button
                type="button"
                onClick={handleCompile}
                disabled={compiling}
                className={`mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tone.button}`}
              >
                {compiling && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />}
                {compiling ? 'Sending images…' : 'Compile 3D model'}
              </button>
              {compileError && <p className="mt-1.5 text-xs text-red-400">{compileError}</p>}
            </div>
            <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className={themePalette.muted}>Progress</span>
                <span className={themePalette.text}>{compileProgress}%</span>
              </div>
              <div className={`h-2 rounded-full ${tone.strong}`}>
                <div className={`h-2 rounded-full ${tone.dot} transition-all`} style={{ width: `${compileProgress}%` }} />
              </div>
            </div>
            <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
              <p className={`text-[10px] uppercase ${themePalette.muted}`}>Export</p>
              <button
                type="button"
                onClick={handleExport}
                disabled={compileProgress < 100 || exporting}
                className={`mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tone.button}`}
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} /> : <Download className="h-3.5 w-3.5" strokeWidth={2.25} />}
                {exporting ? 'Exporting…' : modelExported ? 'Model exported (.glb)' : 'Export model (.glb)'}
              </button>
              <p className={`mt-1.5 text-xs ${exportError ? 'text-red-400' : themePalette.muted}`}>
                {exportError || (compileProgress < 100 ? 'Finish compiling to enable export.' : 'Downloads the live scene as a glTF 2.0 binary file.')}
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (activeTab === 'Translation') {
      return (
        <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
          <div className={`rounded-2xl border p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.18)] ${tone.strong} ${themePalette.card}`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.button}`}>
                  <LanguagesIcon className="h-4.5 w-4.5" strokeWidth={2.25} />
                </div>
                <div>
                  <p className={`text-[10px] uppercase ${themePalette.muted}`}>Target</p>
                  <h3 className={`font-medium ${themePalette.text}`}>Top view</h3>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.button}`}>No rotate</span>
            </div>
            <div className={`flex min-h-[260px] items-center justify-center rounded-xl border ${themePalette.surface}`}>
              <div className="h-36 w-36 rounded-xl border border-slate-300/70 bg-slate-100/90 shadow-[0_14px_40px_rgba(15,23,42,0.15)]" />
            </div>
          </div>

          <div className={`space-y-2 rounded-2xl border p-3 bg-[#0c1017] ${themePalette.card}`}>
            <div className={`flex items-center justify-between rounded-xl border p-2 bg-[#0d1219] ${themePalette.surface}`}>
              <div>
                <p className={`text-[10px] uppercase ${themePalette.muted}`}>Text</p>
                <p className={`text-sm ${themePalette.text}`}>Live translation</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTranslation((value) => !value)}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition ${showTranslation ? tone.button : themePalette.chip}`}
              >
                {showTranslation ? 'On' : 'Off'}
              </button>
            </div>

            <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
              <label className={`mb-1 block text-[10px] uppercase ${themePalette.muted}`} htmlFor="language">
                Language ({languages.length} available)
              </label>
              <select
                id="language"
                value={targetLang}
                onChange={(event) => setTargetLang(event.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${themePalette.outline} ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
              >
                {languages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
              <p className={`text-[10px] uppercase ${themePalette.muted}`}>Preview</p>
              {!showTranslation ? (
                <p className={`mt-1 text-sm ${themePalette.secondary}`}>Live translation is off.</p>
              ) : translating ? (
                <p className={`mt-1 flex items-center gap-1.5 text-sm ${themePalette.secondary}`}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
                  Translating…
                </p>
              ) : translateError ? (
                <p className="mt-1 text-sm text-red-400">{translateError}</p>
              ) : (
                <p className={`mt-1 text-sm ${themePalette.secondary}`}>{translatedText || 'Output will appear here.'}</p>
              )}
            </div>
            <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
              <p className={`text-[10px] uppercase ${themePalette.muted}`}>Source</p>
              <p className={`mt-1 text-sm ${themePalette.secondary}`}>"{translationSampleText}"</p>
            </div>
            <div className={`rounded-xl border p-2 ${themePalette.surface}`}>
              <p className={`text-[10px] uppercase ${themePalette.muted}`}>Next</p>
              <p className={`mt-1 text-sm ${themePalette.secondary}`}>Export output once the latest frame is captured.</p>
            </div>
          </div>
        </div>
      )
    }

    if (activeTab === 'Debug') {
      const detailedDiagnostics = [
        {
          label: 'CPU temperature',
          value: systemStats?.cpuTempC != null ? `${systemStats.cpuTempC}°C` : 'Unavailable',
          ok: systemStats?.cpuTempC == null ? null : systemStats.cpuTempC < 70,
        },
        {
          label: 'Thermal throttling',
          value: systemStats?.throttled == null ? 'Unavailable' : systemStats.throttled ? 'Active' : 'Not active',
          ok: systemStats?.throttled == null ? null : !systemStats.throttled,
        },
        {
          label: 'Memory free',
          value: systemStats ? formatBytes(systemStats.memory.freeBytes) : 'Unavailable',
          ok: systemStats ? systemStats.memory.freeBytes / systemStats.memory.totalBytes > 0.1 : null,
        },
        {
          label: 'Swap usage',
          value: systemStats?.swapUsedBytes == null ? 'Unavailable' : formatBytes(systemStats.swapUsedBytes),
          ok: systemStats?.swapUsedBytes == null ? null : systemStats.swapUsedBytes < 256 * 1024 * 1024,
        },
        {
          label: 'Storage free space',
          value: systemStats?.storage ? formatBytes(systemStats.storage.freeBytes) : 'Unavailable',
          ok: systemStats?.storage ? systemStats.storage.usedPercent < 90 : null,
        },
        {
          label: 'Wi-Fi signal strength',
          value: wifiStatus.connected && wifiStatus.signal != null ? `${wifiStatus.signal}%` : 'Not connected',
          ok: wifiStatus.connected && wifiStatus.signal != null ? wifiStatus.signal > 40 : null,
        },
        {
          label: 'Camera frame drop rate',
          value: cameraStats?.streaming ? `${cameraStats.dropRatePercent}%` : 'Idle',
          ok: cameraStats?.streaming ? cameraStats.dropRatePercent < 15 : null,
        },
        {
          label: 'Camera stream uptime',
          value: cameraStats?.streaming ? formatUptime(cameraStats.streamUptimeSeconds) : 'Not streaming',
          ok: cameraStats?.streaming ? true : null,
        },
      ]

      return (
        <div className="space-y-3">
          <div className={`rounded-2xl border p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.18)] ${tone.strong} ${themePalette.card}`}>
            <p className={`mb-2 text-[10px] uppercase tracking-[0.15em] ${themePalette.muted}`}>Key diagnostics</p>
            <div className="grid gap-2 md:grid-cols-2">
              {[
                ['Latency', latencyMs === null ? 'Unreachable' : `${latencyMs} ms`],
                ['Images/sec', cameraStats?.streaming ? `${cameraStats.fps}` : '0'],
                ['Frame sync', !cameraStats?.streaming ? 'Idle' : cameraStats.frameSyncOk ? 'Stable' : 'Degraded'],
                ['CPU load', systemStats?.cpuLoadPercent != null ? `${systemStats.cpuLoadPercent}%` : 'Unavailable'],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-xl border p-2 ${themePalette.surface}`}>
                  <p className={`text-[10px] uppercase ${themePalette.muted}`}>{label}</p>
                  <p className={`mt-1 text-lg font-semibold ${themePalette.text}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl border p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.18)] ${tone.strong} ${themePalette.card}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] ${themePalette.muted}`}>
                <Terminal className="h-3 w-3" strokeWidth={2.25} />
                System commands
              </p>
              {!authenticated && (
                <span className={`inline-flex items-center gap-1 text-[10px] ${themePalette.muted}`}>
                  <Lock className="h-3 w-3" strokeWidth={2.25} />
                  Locked
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedCommand}
                onChange={(event) => setSelectedCommand(event.target.value)}
                disabled={!authenticated}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50 ${themePalette.outline} ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
              >
                {systemCommands.map((command) => (
                  <option key={command.id} value={command.id}>
                    {command.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleRunCommand}
                disabled={!authenticated || commandRunning}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tone.button}`}
              >
                {commandRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />}
                Run
              </button>
            </div>
            {!authenticated ? (
              <p className={`mt-2 text-xs ${themePalette.muted}`}>Sign in from Settings to run system commands.</p>
            ) : commandResult ? (
              <p className={`mt-2 text-xs ${commandResult.success ? themePalette.secondary : 'text-red-400'}`}>
                {commandResult.message || (commandResult.success ? 'Command completed.' : 'Command failed.')}
              </p>
            ) : null}
          </div>

          <div className={`rounded-2xl border p-3 bg-[#0c1017] ${themePalette.card}`}>
            <p className={`mb-2 text-[10px] uppercase tracking-[0.15em] ${themePalette.muted}`}>Detailed diagnostics</p>
            <div className={`max-h-[280px] overflow-y-auto rounded-xl border p-2 bg-[#0d1219] ${themePalette.surface}`}>
              <div className="space-y-2">
                {detailedDiagnostics.map((entry, index) => (
                  <div
                    key={entry.label}
                    className={`flex items-center justify-between gap-2 rounded-xl border-y border-r px-2.5 py-2 border-l-4 ${themePalette.outline} ${entry.ok === false ? 'border-l-amber-500/60' : entry.ok === true ? tone.borderAccent : 'border-l-slate-500/40'} ${index % 2 === 0 ? themePalette.zebra : ''}`}
                  >
                    <span className={`text-sm ${themePalette.secondary}`}>{entry.label}</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs ${themePalette.muted}`}>
                      {entry.value}
                      <span className={`h-1.5 w-1.5 rounded-full ${entry.ok === false ? 'bg-amber-500' : entry.ok === true ? tone.dot : 'bg-slate-500'}`} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (activeTab === 'Home') {
      return (
        <div className="space-y-2.5">
          <div className={`rounded-2xl border p-3 ${tone.strong} ${themePalette.card}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className={`text-[10px] uppercase tracking-[0.2em] ${themePalette.muted}`}>Local camera hub</p>
                <h3 className={`mt-0.5 text-lg font-semibold ${themePalette.text}`}>A compact control surface for your Pi translator.</h3>
                <p className={`mt-1 max-w-2xl text-sm ${themePalette.secondary}`}>
                  Monitor the camera, inspect 3D output, and review diagnostics from one workspace.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => authenticated && setWifiOpen(true)}
                  disabled={!authenticated}
                  title={authenticated ? undefined : 'Sign in from Settings to manage Wi-Fi.'}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${authenticated ? `cursor-pointer ${tone.button}` : `cursor-not-allowed opacity-50 ${themePalette.chip}`}`}
                >
                  {authenticated ? <Wifi className="h-3.5 w-3.5" strokeWidth={2.25} /> : <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  Wi-Fi
                </button>
                <a
                  href="https://github.com/DoctorBeryl/Braillescan-Mesh-Translator"
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${tone.button}`}
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                  GitHub
                </a>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {tabs.filter((tab) => tab.name !== 'Home').map((tab) => {
              const cardTone = activeTone[tab.name] || tone
              const TabIcon = tabIcons[tab.name]
              return (
                <button
                  key={tab.name}
                  type="button"
                  onClick={() => setActiveTab(tab.name)}
                  className={`group cursor-pointer rounded-2xl border p-2.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${cardTone.soft}`}
                >
                  <div className={`mb-1.5 inline-flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${cardTone.button}`}>
                    <TabIcon className="h-4.5 w-4.5" strokeWidth={2.25} />
                  </div>
                  <h4 className={`text-sm font-semibold ${themePalette.text}`}>{tab.name}</h4>
                  <p className={`mt-1 text-sm leading-5 ${themePalette.secondary}`}>{tabDescriptions[tab.name]}</p>
                </button>
              )
            })}
          </div>

          {(() => {
            const cameraRow = !cameraChecked
              ? { title: 'Camera', detail: 'Checking for a camera…', dot: 'bg-slate-500', ok: false }
              : !cameraAvailable
                ? { title: 'No camera detected', detail: 'Connect a camera module to begin.', dot: 'bg-slate-500', ok: false }
                : cameraStreaming
                  ? { title: 'Camera ready — On', detail: 'Live feed is streaming now.', dot: activeTone.Livestream.dot, ok: true }
                  : { title: 'Camera ready — Off', detail: 'Module is idle. Start the livestream to go live.', dot: 'bg-slate-500', ok: false }

            const wifiRow = !wifiStatus.checked
              ? { title: 'Wi-Fi', detail: 'Checking connection…', dot: 'bg-slate-500', ok: false }
              : wifiStatus.connected
                ? { title: 'Wi-Fi connected', detail: `Connected to "${wifiStatus.ssid}".`, dot: activeTone.Home.dot, ok: true }
                : { title: 'Wi-Fi not connected', detail: 'No active Wi-Fi connection.', dot: 'bg-slate-500', ok: false }

            const latencyRow = latencyMs === null
              ? { title: 'Latency unknown', detail: 'Unable to reach the Pi server.', dot: 'bg-slate-500', ok: false }
              : { title: 'Latency', detail: `${latencyMs} ms round-trip to the Pi server.`, dot: activeTone.Debug.dot, ok: true }

            const statusRows = [cameraRow, wifiRow, latencyRow]
            const nominalCount = statusRows.filter((row) => row.ok).length

            return (
              <div className={`rounded-2xl border p-3 ${themePalette.card}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-[10px] uppercase ${themePalette.muted}`}>Status</p>
                    <h4 className={`text-sm font-semibold ${themePalette.text}`}>Application status</h4>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.button}`}>{nominalCount}/3 nominal</span>
                </div>
                <div className="mt-2 space-y-2">
                  {statusRows.map((row) => (
                    <div key={row.title} className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${themePalette.surface}`}>
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
                      <div>
                        <p className={`text-sm font-medium ${themePalette.text}`}>{row.title}</p>
                        <p className={`mt-0.5 text-sm ${themePalette.secondary}`}>{row.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <div className={`rounded-2xl border p-3 ${themePalette.card}`}>
            <p className={`text-[10px] uppercase ${themePalette.muted}`}>System resources</p>
            <div className="mt-2 space-y-2">
              {[
                [Clock, 'Uptime', systemStats ? formatUptime(systemStats.uptimeSeconds) : 'Unavailable'],
                [HardDrive, 'Storage used', systemStats?.storage?.usedPercent != null ? `${systemStats.storage.usedPercent}%` : 'Unavailable'],
                [Cpu, 'CPU temp', systemStats?.cpuTempC != null ? `${systemStats.cpuTempC}°C` : 'Unavailable'],
                [Activity, 'Memory free', systemStats ? formatBytes(systemStats.memory.freeBytes) : 'Unavailable'],
              ].map(([RowIcon, item, value], index) => (
                <div key={item} className={`flex items-center justify-between rounded-xl border px-2.5 py-2 ${themePalette.surface} ${index % 2 === 0 ? themePalette.zebra : ''}`}>
                  <span className={`flex items-center gap-1.5 text-sm ${themePalette.secondary}`}>
                    <RowIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    {item}
                  </span>
                  <span className={`text-xs ${themePalette.muted}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className={`min-h-screen p-3 transition-all duration-700 sm:p-4 lg:p-5 ${themePalette.page} ${pageGlow[activeTab] || pageGlow.Home}`} style={scaleStyle}>
      <div className={`relative mx-auto flex max-w-6xl flex-col gap-3 overflow-hidden rounded-[24px] border p-3 shadow-[0_8px_30px_rgba(15,23,42,0.12)] transition-all duration-700 ${themePalette.shell}`}>
        <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${tone.bar} transition-all duration-700`} />
        <header className={`flex items-center justify-between rounded-[18px] border px-3 py-2 ${themePalette.surface}`}>
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-700 ${tone.button}`}>
              <Aperture className="h-4.5 w-4.5" strokeWidth={2.25} />
            </div>
            <div>
              <p className={`text-sm font-semibold tracking-tight ${themePalette.text}`}>Pi Translator</p>
              <p className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] ${themePalette.accent}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                {headerCaptions[activeTab] || headerCaptions.Home}
              </p>
            </div>
          </div>
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((value) => !value)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-medium transition ${tone.button}`}
              aria-label="Open settings"
              aria-expanded={settingsOpen}
            >
              <Settings className={`h-4.5 w-4.5 transition-transform duration-300 ${settingsOpen ? 'rotate-45' : ''}`} strokeWidth={2.25} />
            </button>
            <div className={`absolute right-0 top-11 z-20 w-72 overflow-hidden rounded-2xl border shadow-xl transition-all duration-300 ${settingsOpen ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-2'} ${themePalette.surface}`}>
              <div className={`flex items-center justify-between border-b px-3 py-2.5 ${themePalette.border}`}>
                <p className={`text-sm font-semibold ${themePalette.text}`}>Settings</p>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition ${themePalette.chip}`}
                  aria-label="Close settings"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </div>

              <div className="space-y-3.5 p-3">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${themePalette.muted}`}>
                      <Palette className="h-3.5 w-3.5" strokeWidth={2.25} />
                      Appearance
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'bright' : 'dark')}
                    className={`relative flex h-8 w-full cursor-pointer items-center rounded-full border px-1 transition ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} ${themePalette.border}`}
                    aria-label="Toggle theme"
                  >
                    <span
                      className={`absolute flex h-6 w-[calc(50%-4px)] items-center justify-center gap-1 rounded-full text-xs font-medium transition-transform duration-300 ${tone.button} ${theme === 'dark' ? 'translate-x-0' : 'translate-x-[calc(100%+8px)]'}`}
                    >
                      {theme === 'dark' ? <Moon className="h-3.5 w-3.5" strokeWidth={2.25} /> : <Sun className="h-3.5 w-3.5" strokeWidth={2.25} />}
                      {theme === 'dark' ? 'Dark' : 'Light'}
                    </span>
                  </button>
                </div>

                <div className={`border-t pt-3 ${themePalette.border}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${themePalette.muted}`}>
                      <Type className="h-3.5 w-3.5" strokeWidth={2.25} />
                      Text size
                    </p>
                    <p className={`text-xs font-medium ${themePalette.text}`}>{textPercent}%</p>
                  </div>
                  <input
                    type="range"
                    min="85"
                    max="125"
                    step="5"
                    value={textPercent}
                    onChange={(event) => setTextPercent(Number(event.target.value))}
                    className="w-full cursor-pointer"
                    style={{ accentColor: tone.hex }}
                  />
                </div>

                <div className={`border-t pt-3 ${themePalette.border}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${themePalette.muted}`}>
                      <KeyRound className="h-3.5 w-3.5" strokeWidth={2.25} />
                      Admin sign-in
                    </p>
                    {authenticated && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${themePalette.accent}`}>
                        <ShieldCheck className="h-3 w-3" strokeWidth={2.25} />
                        Signed in
                      </span>
                    )}
                  </div>

                  {authenticated ? (
                    <div className={`rounded-xl border p-2.5 ${themePalette.surface}`}>
                      <p className={`text-sm ${themePalette.text}`}>Signed in as {ADMIN_USERNAME}</p>
                      <p className={`mt-0.5 text-xs ${themePalette.muted}`}>Wi-Fi and system commands are unlocked.</p>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className={`mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${themePalette.chip}`}
                      >
                        <LogOut className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <form className="space-y-2" onSubmit={handleLogin}>
                      <input
                        type="text"
                        value={authUsername}
                        onChange={(event) => setAuthUsername(event.target.value)}
                        placeholder="Username"
                        autoComplete="off"
                        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${themePalette.outline} ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
                      />
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                        placeholder="Password"
                        autoComplete="off"
                        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${themePalette.outline} ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}
                      />
                      {authError && <p className="text-xs text-red-400">{authError}</p>}
                      <button
                        type="submit"
                        className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${tone.button}`}
                      >
                        <LogIn className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Sign in
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <nav className={`flex flex-wrap gap-2 rounded-[16px] border p-1.5 ${themePalette.surface}`}>
          {tabs.map((tab) => {
            const TabIcon = tabIcons[tab.name]
            return (
              <button
                key={tab.name}
                type="button"
                onClick={() => setActiveTab(tab.name)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition ${activeTab === tab.name ? `${tone.button} border-transparent shadow-[0_8px_18px_rgba(0,0,0,0.14)]` : `${themePalette.tabInactive} border-transparent`}`}
              >
                <TabIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </nav>

        <main>
          <div className={activeTab === 'Livestream' ? undefined : 'hidden'}>{livestreamContent}</div>
          {activeTab !== 'Livestream' && renderTabContent()}
        </main>
      </div>

      <WifiPanel
        open={wifiOpen}
        onClose={() => setWifiOpen(false)}
        theme={theme}
        themePalette={themePalette}
        tone={tone}
      />

      {imagesPopup && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setImagesPopup(null)}
        >
          <div
            className={`w-full max-w-2xl rounded-2xl border p-4 shadow-2xl ${themePalette.surface}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className={`text-sm font-semibold ${themePalette.text}`}>Compile results ({imagesPopup.images.length})</p>
              <button
                type="button"
                onClick={() => setImagesPopup(null)}
                className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition ${themePalette.chip}`}
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </div>
            {imagesPopup.images.length === 0 ? (
              <p className={`mt-3 text-sm ${themePalette.secondary}`}>No output images were produced.</p>
            ) : (
              <div className="mt-3 grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {imagesPopup.images.map((image) => (
                  <a
                    key={image.name}
                    href={`data:image/jpeg;base64,${image.data}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`block overflow-hidden rounded-xl border ${themePalette.outline}`}
                  >
                    <img
                      src={`data:image/jpeg;base64,${image.data}`}
                      alt={image.name}
                      className="h-28 w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
