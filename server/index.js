import express from 'express'
import { execFile, spawn } from 'child_process'

const WIFI_IFACE = 'wlan1'
const PORT = process.env.WIFI_SERVER_PORT || 3001

// Raspberry Pi OS renamed libcamera-apps to rpicam-apps in late 2023;
// try the modern binaries first and fall back for older installs.
const CAMERA_LIST_BINARIES = ['rpicam-hello', 'libcamera-hello']
const CAMERA_VIDEO_BINARY_FOR = {
  'rpicam-hello': 'rpicam-vid',
  'libcamera-hello': 'libcamera-vid',
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
    '--framerate', '15',
    '--nopreview',
  ])

  const cleanup = () => {
    child.kill('SIGTERM')
  }
  req.on('close', cleanup)
  res.on('close', cleanup)

  child.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message })
    } else if (!res.writableEnded) {
      res.end()
    }
  })
  child.on('exit', () => {
    if (!res.writableEnded) res.end()
  })

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache, private',
    Pragma: 'no-cache',
    Connection: 'close',
  })

  let buffer = Buffer.alloc(0)

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

      res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`)
      res.write(frame)
      res.write('\r\n')
    }
  })
})

app.listen(PORT, () => {
  console.log(`Wi-Fi server listening on port ${PORT}`)
})
