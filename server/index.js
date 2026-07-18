import express from 'express'
import { execFile } from 'child_process'

const WIFI_IFACE = 'wlan1'
const PORT = process.env.WIFI_SERVER_PORT || 3001

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

app.listen(PORT, () => {
  console.log(`Wi-Fi server listening on port ${PORT}`)
})
