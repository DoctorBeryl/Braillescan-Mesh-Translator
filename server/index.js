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
const OUTPUT_DIR = path.join(SERVER_DIR, '..', 'output')
const IMAGE_SAVE_INTERVAL_MS = 1000
const COMPILE_SCRIPT = path.join(SERVER_DIR, 'compile.py')
const COMPILE_TIMEOUT_MS = 5 * 60 * 1000
const DISTANCE_SCRIPT = path.join(SERVER_DIR, 'distance.py')
const DISTANCE_TIMEOUT_MS = 2500
const DISTANCE_EMA_WEIGHT = 0.92
let lastDistanceOutputCm = null
// Keep in sync with idealFocalDistanceCm in src/App.jsx and FOCAL_DISTANCE_CM
// in lcd.py. This tolerance is tighter than lcd.py's FOCAL_TOLERANCE_CM (1cm,
// just for the "move closer/farther" hint) -- a still only gets kept for the
// scan if it's close enough to the focal plane to plausibly be in focus.
const FOCAL_DISTANCE_CM = 4.8
const IMAGE_SAVE_DISTANCE_TOLERANCE_CM = 1.5
const IMAGE_SAVE_MIN_SHARPNESS_PERCENT = 55
// Sharpness is computed client-side (browser canvas + JS, see
// CameraStream.jsx) instead of via a server-side cv2 subprocess -- the
// browser has CPU to spare and the Pi doesn't, which is exactly what the
// earlier cv2-subprocess approach kept running into. The browser POSTs its
// reading here and lcd.py/the web UI both just read back whatever was last
// reported.
const SHARPNESS_REPORT_STALE_MS = 5000
let lastSharpnessReport = null

// Wipe stills left over from the previous session so a fresh boot always
// starts a scan from an empty raspimages/ -- otherwise old frames would get
// mixed into (or mistaken for) the next scan.
await fs.rm(IMAGES_DIR, { recursive: true, force: true })
await fs.mkdir(IMAGES_DIR, { recursive: true })

// Raspberry Pi OS renamed libcamera-apps to rpicam-apps in late 2023;
// try the modern binaries first and fall back for older installs.
const CAMERA_LIST_BINARIES = ['rpicam-hello', 'libcamera-hello']
const CAMERA_VIDEO_BINARY_FOR = {
  'rpicam-hello': 'rpicam-vid',
  'libcamera-hello': 'libcamera-vid',
}
const CAMERA_TARGET_FPS = 10

const cameraStats = {
  streaming: false,
  startedAt: null,
  lastFrameAt: null,
  frameTimestamps: [],
}

// Only one rpicam-vid/libcamera-vid process can hold the camera device at a
// time. Without this, quickly retoggling idle->live spawns a new process
// before the old one has released the hardware, so the new stream fails to
// acquire the camera -- the CameraStream <img> errors out and everything
// downstream that gates on "is streaming" (distance/sharpness polling)
// looks like it silently stopped.
let cameraReleased = Promise.resolve()
async function waitForCameraRelease() {
  await Promise.race([
    cameraReleased,
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
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

// Like run(), but with no output-buffer limit and a much longer timeout --
// stitching a batch of images can take far longer than the 20s budget used
// for quick system commands, especially on Pi-class hardware.
function runLong(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args)
    let stdout = ''
    let stderr = ''

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Process timed out.'))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `Process exited with code ${code}`))
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

  await waitForCameraRelease()
  if (res.writableEnded || req.destroyed) return

  let released = false
  let resolveReleased
  cameraReleased = new Promise((resolve) => { resolveReleased = resolve })
  const markReleased = () => {
    if (released) return
    released = true
    resolveReleased()
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
    markReleased()
    if (!res.headersSent) {
      res.status(500).json({ message: err.message })
    } else if (!res.writableEnded) {
      res.end()
    }
  })
  child.on('exit', () => {
    cameraStats.streaming = false
    markReleased()
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
  let imageSaveInFlight = false

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
      // at the full stream framerate. Writes are serialized (never more than
      // one in flight) -- firing a new writeFile every second regardless of
      // whether the previous one finished let writes pile up whenever the SD
      // card fell behind, and they'd all land at once in a laggy burst.
      //
      // Only the write itself is throttled to that interval, not the gate
      // check below -- distance/sharpness are just cheap reads of already-
      // cached values, so re-checking on every incoming frame means a still
      // gets grabbed the instant the surface comes into range instead of up
      // to a second late.
      if (!imageSaveInFlight && now - lastImageSavedAt >= IMAGE_SAVE_INTERVAL_MS) {
        const inFocalRange = lastDistanceOutputCm != null
          && Math.abs(lastDistanceOutputCm - FOCAL_DISTANCE_CM) < IMAGE_SAVE_DISTANCE_TOLERANCE_CM
        // sharpnessPercent comes from the browser's own analysis of the live
        // frame (see CameraStream.jsx) -- the Pi doesn't re-derive it here,
        // it just reads back whatever the receiving PC last reported. A
        // stale report (tab closed, analysis loop stalled) is treated the
        // same as no report, same staleness window as GET /api/sharpness.
        const sharpnessPercent = lastSharpnessReport != null
          && now - lastSharpnessReport.reportedAt <= SHARPNESS_REPORT_STALE_MS
          ? lastSharpnessReport.sharpnessPercent
          : null
        const sharpEnough = sharpnessPercent != null && sharpnessPercent >= IMAGE_SAVE_MIN_SHARPNESS_PERCENT

        if (inFocalRange && sharpEnough) {
          lastImageSavedAt = now
          imageSaveInFlight = true
          const filename = `img-${now}.jpg`
          fs.writeFile(path.join(IMAGES_DIR, filename), frame)
            // Errors here used to vanish silently, so a stuck image counter
            // gave no clue whether frames just weren't arriving or writes
            // were actually failing (e.g. disk pressure) -- log so that
            // distinction shows up in the service's journal.
            .catch((err) => console.error(`Failed to save ${filename}:`, err.message))
            .finally(() => { imageSaveInFlight = false })
        }
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
  } catch (err) {
    // Used to fail silently, so a stuck "0 stored images" counter gave no
    // clue whether stills genuinely weren't being saved or this listing
    // itself couldn't see them (wrong path, permissions, dir removed out
    // from under it) -- log so that distinction shows up in the journal.
    console.error('Failed to list saved images:', err.message)
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

// Raspberry Pi OS ships python3 only; some dev machines still expose plain
// "python" for a Python 3 install, so try both rather than hardcoding one.
const PYTHON_BINARIES = ['python3', 'python']

async function listOutputImages() {
  let entries
  try {
    entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isFile() && /\.(jpe?g|png)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort()
}

// Reads every stitched piece compile.py wrote to ./output and sends it to
// the client in one response, so the "view results" menu can render them.
app.get('/api/output/images', async (_req, res) => {
  const names = await listOutputImages()
  const images = await Promise.all(names.map(async (name) => {
    const data = await fs.readFile(path.join(OUTPUT_DIR, name))
    return { name, data: data.toString('base64') }
  }))
  res.json({ count: images.length, images })
})

app.post('/api/compile', async (_req, res) => {
  let lastErr = new Error('No Python interpreter found (tried python3, python).')

  for (const bin of PYTHON_BINARIES) {
    try {
      const stdout = await runLong(bin, [COMPILE_SCRIPT], COMPILE_TIMEOUT_MS)
      res.json({ success: true, output: stdout.trim() })
      return
    } catch (err) {
      if (err.code === 'ENOENT') {
        lastErr = err
        continue
      }
      res.status(500).json({ success: false, message: err.message })
      return
    }
  }

  res.status(500).json({ success: false, message: lastErr.message })
})

async function runPythonJson(script, timeoutMs) {
  let lastErr = new Error('No Python interpreter found (tried python3, python).')

  for (const bin of PYTHON_BINARIES) {
    try {
      const stdout = await runLong(bin, [script], timeoutMs)
      const data = JSON.parse(stdout.trim())
      if (data.error) throw new Error(data.error)
      return data
    } catch (err) {
      if (err.code === 'ENOENT') {
        lastErr = err
        continue
      }
      throw err
    }
  }

  throw lastErr
}

// Both the web UI and lcd.py poll /api/distance on their own timers at the
// same cadence, so their requests regularly land close together without
// actually overlapping. Coalescing alone only merges calls that are truly
// in-flight at the same instant -- two callers a few hundred ms out of phase
// still spawn their own subprocess. On a Pi 3 A+ (512MB RAM), two
// GPIO-contending distance.py runs every poll cycle is real, sustained
// CPU/memory pressure (visible as python3 and kswapd0 usage while the camera
// stream is also competing for the CPU), so on top of coalescing the
// in-flight case, cache the last result for slightly under the shared poll
// interval -- any caller within that window gets the still-fresh cached
// reading instead of forcing a second subprocess spawn.
function coalesce(fn, cacheTtlMs = 0) {
  let inFlight = null
  let cachedAt = 0
  let cachedValue
  return () => {
    if (cacheTtlMs > 0 && cachedAt && Date.now() - cachedAt < cacheTtlMs) {
      return Promise.resolve(cachedValue)
    }
    if (!inFlight) {
      inFlight = fn()
        .then((value) => {
          cachedValue = value
          cachedAt = Date.now()
          return value
        })
        .finally(() => { inFlight = null })
    }
    return inFlight
  }
}

// Kept comfortably under the shared 500ms poll interval so a caller never
// sees a reading older than one poll cycle -- this only absorbs the
// redundant second subprocess spawn, not the actual refresh rate.
const readDistance = coalesce(() => runPythonJson(DISTANCE_SCRIPT, DISTANCE_TIMEOUT_MS), 400)

// Distance is read from an HC-SR04 (TRIG on board pin 29, ECHO on pin 31)
// via a short-lived Python helper -- Node has no first-party GPIO access.
// distance.py takes 4 readings per call (in the time one used to take) and
// returns their average; here that average is blended with the last output
// (92% new / 8% previous) so the UI sees a smoothed value each poll.
app.get('/api/distance', async (_req, res) => {
  try {
    const data = await readDistance()
    const smoothedCm = lastDistanceOutputCm == null
      ? data.distanceCm
      : DISTANCE_EMA_WEIGHT * data.distanceCm + (1 - DISTANCE_EMA_WEIGHT) * lastDistanceOutputCm
    lastDistanceOutputCm = smoothedCm
    res.json({ distanceCm: Math.round(smoothedCm * 10) / 10 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

function isFiniteInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

// The browser computes blur/sharpness itself (Laplacian-variance over a
// downsampled canvas grab of the live frame, see CameraStream.jsx) and
// reports it here once a second. This replaces spawning sharpness.py per
// poll -- cv2's import was slow and CPU-heavy enough on Pi-class hardware
// to compete with the camera stream for the same resources; the browser has
// no such constraint.
app.post('/api/sharpness', (req, res) => {
  const { sharpness, sharpnessPercent, blurry } = req.body ?? {}
  if (!isFiniteInRange(sharpnessPercent, 0, 100) || typeof blurry !== 'boolean') {
    res.status(400).json({ message: 'sharpnessPercent (0-100) and blurry (boolean) are required.' })
    return
  }

  lastSharpnessReport = {
    sharpness: typeof sharpness === 'number' && Number.isFinite(sharpness) ? sharpness : null,
    sharpnessPercent,
    blurry,
    reportedAt: Date.now(),
  }
  res.json({ ok: true })
})

app.get('/api/sharpness', (_req, res) => {
  if (!lastSharpnessReport || Date.now() - lastSharpnessReport.reportedAt > SHARPNESS_REPORT_STALE_MS) {
    res.status(503).json({ message: 'No recent sharpness report from a connected browser.' })
    return
  }

  const { sharpness, sharpnessPercent, blurry } = lastSharpnessReport
  res.json({ sharpness, sharpnessPercent, blurry })
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
