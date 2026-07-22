import express from 'express'
import { execFile, spawn } from 'child_process'
import { translate } from '@vitalets/google-translate-api'
import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WIFI_IFACE = 'wlan1'
const PORT = process.env.WIFI_SERVER_PORT || 3001

// Resolved from this file's location (not process.cwd()) so it's stable
// regardless of which directory `npm run dev`/`npm run server` is launched from.
const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = path.join(SERVER_DIR, '..', 'raspimages')
const IMAGE_SAVE_INTERVAL_MS = 1000

await fs.mkdir(IMAGES_DIR, { recursive: true })

// Raspberry Pi OS renamed libcamera-apps to rpicam-apps in late 2023;
// try the modern binaries first and fall back for older installs.
const CAMERA_LIST_BINARIES = ['rpicam-hello', 'libcamera-hello']
const CAMERA_VIDEO_BINARY_FOR = {
  'rpicam-hello': 'rpicam-vid',
  'libcamera-hello': 'libcamera-vid',
}
const CAMERA_TARGET_FPS = 15

const cameraStats = {
  streaming: false,
  startedAt: null,
  lastFrameAt: null,
  frameTimestamps: [],
}

const app = express()
app.use(express.json({ limit: '10kb' }))

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    // execFile never spawns a shell, so args are passed as literal argv
    // entries to the target binary -- untrusted ssid/password values can't
    // break out into shell metacharacters the way they could with exec().
    execFile(cmd, args, { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr?.trim() || err.message))
        return
      }
      resolve(stdout)
    })
  })
}

app.get('/api/wifi/interface', async (_req, res) => {
  try {
    await run('ip', ['link', 'show', WIFI_IFACE])
    res.json({ exists: true, ifname: WIFI_IFACE })
  } catch {
    res.json({ exists: false, ifname: WIFI_IFACE })
  }
})

// nmcli terse output escapes literal ':' inside a field as '\:'
function parseTerseLine(line) {
  const fields = []
  let current = ''
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '\\' && line[i + 1] === ':') {
      current += ':'
      i += 1
    } else if (char === ':') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

app.get('/api/wifi/networks', async (_req, res) => {
  try {
    const stdout = await run('nmcli', [
      '-t',
      '-f', 'SSID,SIGNAL,SECURITY,IN-USE',
      'device', 'wifi', 'list',
      'ifname', WIFI_IFACE,
      '--rescan', 'yes',
    ])

    const bySsid = new Map()
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const [ssid, signal, security, inUse] = parseTerseLine(line)
      if (!ssid) continue

      const signalNum = Number(signal) || 0
      const existing = bySsid.get(ssid)
      if (!existing || signalNum > existing.signal) {
        bySsid.set(ssid, {
          ssid,
          signal: signalNum,
          secure: Boolean(security) && security !== '--',
          connected: inUse === '*',
        })
      }
    }

    const networks = [...bySsid.values()].sort((a, b) => b.signal - a.signal)
    res.json({ networks })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

app.get('/api/wifi/status', async (_req, res) => {
  try {
    const stdout = await run('nmcli', [
      '-t',
      '-f', 'SSID,SIGNAL,IN-USE',
      'device', 'wifi', 'list',
      'ifname', WIFI_IFACE,
    ])

    let ssid = null
    let signal = null
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const [name, sig, inUse] = parseTerseLine(line)
      if (inUse === '*' && name) {
        ssid = name
        signal = Number(sig)
        if (Number.isNaN(signal)) signal = null
        break
      }
    }
    res.json({ connected: Boolean(ssid), ssid, signal })
  } catch (err) {
    res.status(500).json({ connected: false, ssid: null, signal: null, message: err.message })
  }
})

function isValidSsid(ssid) {
  return typeof ssid === 'string' && ssid.length > 0 && ssid.length <= 32
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 63
}

app.post('/api/wifi/connect', async (req, res) => {
  const { ssid, password } = req.body ?? {}

  if (!isValidSsid(ssid)) {
    res.status(400).json({ success: false, message: 'Network name must be 1-32 characters.' })
    return
  }

  const hasPassword = password !== undefined && password !== null && password !== ''
  if (hasPassword && !isValidPassword(password)) {
    res.status(400).json({ success: false, message: 'Password must be 8-63 characters.' })
    return
  }

  const args = ['device', 'wifi', 'connect', ssid]
  if (hasPassword) {
    args.push('password', password)
  }
  args.push('ifname', WIFI_IFACE)

  try {
    const stdout = await run('nmcli', args)
    res.json({ success: true, message: stdout.trim() })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

async function detectCamera() {
  for (const listBinary of CAMERA_LIST_BINARIES) {
    try {
      const stdout = await run(listBinary, ['--list-cameras'])
      if (/no cameras available/i.test(stdout)) continue
      if (/^\s*\d+\s*:/m.test(stdout)) {
        return { available: true, videoBinary: CAMERA_VIDEO_BINARY_FOR[listBinary] }
      }
    } catch {
      // binary missing or probe failed; try the next known tool name
    }
  }
  return { available: false, videoBinary: null }
}

app.get('/api/camera/status', async (_req, res) => {
  const { available } = await detectCamera()
  res.json({ available })
})

const JPEG_SOI = Buffer.from([0xff, 0xd8])
const JPEG_EOI = Buffer.from([0xff, 0xd9])

app.get('/api/camera/stream', async (req, res) => {
  const { available, videoBinary } = await detectCamera()
  if (!available) {
    res.status(503).json({ message: 'No camera detected.' })
    return
  }

  const child = spawn(videoBinary, [
    '-t', '0',
    '--codec', 'mjpeg',
    '-o', '-',
    '--width', '640',
    '--height', '480',
    '--framerate', String(CAMERA_TARGET_FPS),
    '--nopreview',
  ])

  cameraStats.streaming = true
  cameraStats.startedAt = Date.now()
  cameraStats.lastFrameAt = null
  cameraStats.frameTimestamps = []

  const cleanup = () => {
    child.kill('SIGTERM')
    cameraStats.streaming = false
  }
  req.on('close', cleanup)
  res.on('close', cleanup)

  child.on('error', (err) => {
    cameraStats.streaming = false
    if (!res.headersSent) {
      res.status(500).json({ message: err.message })
    } else if (!res.writableEnded) {
      res.end()
    }
  })
  child.on('exit', () => {
    cameraStats.streaming = false
    if (!res.writableEnded) res.end()
  })

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache, private',
    Pragma: 'no-cache',
    Connection: 'close',
  })

  let buffer = Buffer.alloc(0)
  let lastImageSavedAt = 0

  child.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    for (;;) {
      const start = buffer.indexOf(JPEG_SOI)
      if (start === -1) {
        buffer = Buffer.alloc(0)
        break
      }
      const end = buffer.indexOf(JPEG_EOI, start + JPEG_SOI.length)
      if (end === -1) {
        if (start > 0) buffer = buffer.subarray(start)
        break
      }

      const frame = buffer.subarray(start, end + JPEG_EOI.length)
      buffer = buffer.subarray(end + JPEG_EOI.length)

      const now = Date.now()
      cameraStats.lastFrameAt = now
      cameraStats.frameTimestamps.push(now)
      const cutoff = now - 2000
      while (cameraStats.frameTimestamps.length && cameraStats.frameTimestamps[0] < cutoff) {
        cameraStats.frameTimestamps.shift()
      }

      // Persist a still every IMAGE_SAVE_INTERVAL_MS so a scan pass builds up
      // a manageable set of frames in ./raspimages instead of flooding disk
      // at the full stream framerate.
      if (now - lastImageSavedAt >= IMAGE_SAVE_INTERVAL_MS) {
        lastImageSavedAt = now
        const filename = `img-${now}.jpg`
        fs.writeFile(path.join(IMAGES_DIR, filename), frame).catch(() => {})
      }

      res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`)
      res.write(frame)
      res.write('\r\n')
    }
  })
})

async function listSavedImages() {
  let entries
  try {
    entries = await fs.readdir(IMAGES_DIR, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jpg'))
    .map((entry) => entry.name)
    .sort()
}

app.get('/api/images/count', async (_req, res) => {
  const names = await listSavedImages()
  res.json({ count: names.length })
})

// Reads every saved still from ./raspimages and sends it to the client in
// one response, ahead of the (placeholder) 3D reconstruction step.
app.get('/api/images', async (_req, res) => {
  const names = await listSavedImages()
  const images = await Promise.all(names.map(async (name) => {
    const data = await fs.readFile(path.join(IMAGES_DIR, name))
    return { name, data: data.toString('base64') }
  }))
  res.json({ count: images.length, images })
})

app.get('/api/camera/stats', (_req, res) => {
  const now = Date.now()
  const recentFrames = cameraStats.frameTimestamps.filter((t) => t >= now - 2000)
  const fps = cameraStats.streaming ? Math.round((recentFrames.length / 2) * 10) / 10 : 0
  const frameSyncOk = cameraStats.streaming
    && cameraStats.lastFrameAt !== null
    && (now - cameraStats.lastFrameAt) < 2000
  const dropRatePercent = cameraStats.streaming
    ? Math.max(0, Math.round(((CAMERA_TARGET_FPS - fps) / CAMERA_TARGET_FPS) * 100))
    : null
  const streamUptimeSeconds = cameraStats.streaming && cameraStats.startedAt
    ? Math.round((now - cameraStats.startedAt) / 1000)
    : 0

  res.json({
    streaming: cameraStats.streaming,
    fps,
    frameSyncOk,
    dropRatePercent,
    streamUptimeSeconds,
  })
})

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, ts: Date.now() })
})

async function readCpuTempC() {
  try {
    const raw = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8')
    return Math.round((Number(raw.trim()) / 1000) * 10) / 10
  } catch {
    return null
  }
}

async function readThrottled() {
  try {
    const stdout = await run('vcgencmd', ['get_throttled'])
    const match = stdout.match(/0x([0-9a-fA-F]+)/)
    if (!match) return null
    const bits = parseInt(match[1], 16)
    return Boolean(bits & 0x4)
  } catch {
    return null
  }
}

async function readSwapUsedBytes() {
  try {
    const raw = await fs.readFile('/proc/meminfo', 'utf8')
    const total = Number(raw.match(/SwapTotal:\s+(\d+)/)?.[1])
    const free = Number(raw.match(/SwapFree:\s+(\d+)/)?.[1])
    if (!Number.isFinite(total)) return null
    return (total - free) * 1024
  } catch {
    return null
  }
}

async function readStorage() {
  try {
    if (typeof fs.statfs !== 'function') return null
    const stats = await fs.statfs('/')
    const totalBytes = stats.blocks * stats.bsize
    const freeBytes = stats.bavail * stats.bsize
    const usedPercent = totalBytes ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : null
    return { totalBytes, freeBytes, usedPercent }
  } catch {
    return null
  }
}

app.get('/api/system/stats', async (_req, res) => {
  const cpuCount = os.cpus().length || 1
  const cpuLoadPercent = Math.min(100, Math.round((os.loadavg()[0] / cpuCount) * 100))

  const [cpuTempC, throttled, swapUsedBytes, storage] = await Promise.all([
    readCpuTempC(),
    readThrottled(),
    readSwapUsedBytes(),
    readStorage(),
  ])

  res.json({
    uptimeSeconds: os.uptime(),
    memory: { totalBytes: os.totalmem(), freeBytes: os.freemem() },
    cpuLoadPercent,
    cpuTempC,
    throttled,
    swapUsedBytes,
    storage,
  })
})

const SYSTEM_COMMANDS = {
  reboot: { label: 'Reboot device', cmd: 'sudo', args: ['-n', 'reboot'] },
  poweroff: { label: 'Power off device', cmd: 'sudo', args: ['-n', 'poweroff'] },
  'restart-network': { label: 'Restart Wi-Fi interface', cmd: 'nmcli', args: ['device', 'reconnect', WIFI_IFACE] },
  'disk-usage': { label: 'Check disk usage', cmd: 'df', args: ['-h'] },
}

app.get('/api/system/commands', (_req, res) => {
  res.json({
    commands: Object.entries(SYSTEM_COMMANDS).map(([id, entry]) => ({ id, label: entry.label })),
  })
})

app.post('/api/system/command', async (req, res) => {
  const { command } = req.body ?? {}
  const entry = SYSTEM_COMMANDS[command]
  if (!entry) {
    res.status(400).json({ success: false, message: 'Unknown command.' })
    return
  }

  try {
    const stdout = await run(entry.cmd, entry.args)
    res.json({ success: true, output: stdout.trim() })
  } catch (err) {
    // `sudo -n` refuses to prompt for a password; on a Pi without the
    // NOPASSWD rule from SETUP_COMMANDS.txt this is the failure every time.
    const message = /password is required|no tty present/i.test(err.message)
      ? `${err.message} — passwordless sudo isn't configured for this command. See "PERMISIUNI ADMIN" in SETUP_COMMANDS.txt.`
      : err.message
    res.status(500).json({ success: false, message })
  }
})

const TRANSLATE_LANGUAGES = [
  ['af', 'Afrikaans'], ['sq', 'Albanian'], ['am', 'Amharic'], ['ar', 'Arabic'],
  ['hy', 'Armenian'], ['az', 'Azerbaijani'], ['eu', 'Basque'], ['be', 'Belarusian'],
  ['bn', 'Bengali'], ['bs', 'Bosnian'], ['bg', 'Bulgarian'], ['ca', 'Catalan'],
  ['ceb', 'Cebuano'], ['ny', 'Chichewa'], ['zh-CN', 'Chinese (Simplified)'],
  ['zh-TW', 'Chinese (Traditional)'], ['co', 'Corsican'], ['hr', 'Croatian'],
  ['cs', 'Czech'], ['da', 'Danish'], ['nl', 'Dutch'], ['en', 'English'],
  ['eo', 'Esperanto'], ['et', 'Estonian'], ['tl', 'Filipino'], ['fi', 'Finnish'],
  ['fr', 'French'], ['fy', 'Frisian'], ['gl', 'Galician'], ['ka', 'Georgian'],
  ['de', 'German'], ['el', 'Greek'], ['gu', 'Gujarati'], ['ht', 'Haitian Creole'],
  ['ha', 'Hausa'], ['haw', 'Hawaiian'], ['he', 'Hebrew'], ['hi', 'Hindi'],
  ['hmn', 'Hmong'], ['hu', 'Hungarian'], ['is', 'Icelandic'], ['ig', 'Igbo'],
  ['id', 'Indonesian'], ['ga', 'Irish'], ['it', 'Italian'], ['ja', 'Japanese'],
  ['jw', 'Javanese'], ['kn', 'Kannada'], ['kk', 'Kazakh'], ['km', 'Khmer'],
  ['rw', 'Kinyarwanda'], ['ko', 'Korean'], ['ku', 'Kurdish'], ['ky', 'Kyrgyz'],
  ['lo', 'Lao'], ['la', 'Latin'], ['lv', 'Latvian'], ['lt', 'Lithuanian'],
  ['lb', 'Luxembourgish'], ['mk', 'Macedonian'], ['mg', 'Malagasy'], ['ms', 'Malay'],
  ['ml', 'Malayalam'], ['mt', 'Maltese'], ['mi', 'Maori'], ['mr', 'Marathi'],
  ['mn', 'Mongolian'], ['my', 'Myanmar (Burmese)'], ['ne', 'Nepali'],
  ['no', 'Norwegian'], ['or', 'Odia'], ['ps', 'Pashto'], ['fa', 'Persian'],
  ['pl', 'Polish'], ['pt', 'Portuguese'], ['pa', 'Punjabi'], ['ro', 'Romanian'],
  ['ru', 'Russian'], ['sm', 'Samoan'], ['gd', 'Scots Gaelic'], ['sr', 'Serbian'],
  ['st', 'Sesotho'], ['sn', 'Shona'], ['sd', 'Sindhi'], ['si', 'Sinhala'],
  ['sk', 'Slovak'], ['sl', 'Slovenian'], ['so', 'Somali'], ['es', 'Spanish'],
  ['su', 'Sundanese'], ['sw', 'Swahili'], ['sv', 'Swedish'], ['tg', 'Tajik'],
  ['ta', 'Tamil'], ['tt', 'Tatar'], ['te', 'Telugu'], ['th', 'Thai'],
  ['tr', 'Turkish'], ['tk', 'Turkmen'], ['uk', 'Ukrainian'], ['ur', 'Urdu'],
  ['ug', 'Uyghur'], ['uz', 'Uzbek'], ['vi', 'Vietnamese'], ['cy', 'Welsh'],
  ['xh', 'Xhosa'], ['yi', 'Yiddish'], ['yo', 'Yoruba'], ['zu', 'Zulu'],
].map(([code, name]) => ({ code, name }))

app.get('/api/translate/languages', (_req, res) => {
  res.json({ languages: TRANSLATE_LANGUAGES })
})

app.post('/api/translate', async (req, res) => {
  const { text, to } = req.body ?? {}

  if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
    res.status(400).json({ message: 'Text must be 1-2000 characters.' })
    return
  }
  if (typeof to !== 'string' || !TRANSLATE_LANGUAGES.some((lang) => lang.code === to)) {
    res.status(400).json({ message: 'Unsupported target language.' })
    return
  }

  try {
    const result = await translate(text, { to })
    res.json({ translated: result.text, from: result.raw?.src || null })
  } catch (err) {
    res.status(502).json({ message: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Wi-Fi server listening on port ${PORT}`)
})
