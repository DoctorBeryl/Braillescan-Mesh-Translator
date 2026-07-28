// Minimal ZIP writer (STORE method -- no compression) so the browser can
// bundle the crescent-matched stills into one download without pulling in a
// third-party zip library. Produces a standard PKZIP archive readable by any
// unzip tool; skipping compression keeps this small and avoids reimplementing
// deflate for images that are already JPEG-compressed anyway.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
  const dosTime = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f)
  const dosDate = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f)
  return { dosTime, dosDate }
}

export function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// files: [{ name: string, data: Uint8Array }]
export function createZipBlob(files) {
  const encoder = new TextEncoder()
  const { dosTime, dosDate } = dosDateTime(new Date())

  const parts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const data = file.data
    const crc = crc32(data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0, true) // flags
    local.setUint16(8, 0, true) // method: store
    local.setUint16(10, dosTime, true)
    local.setUint16(12, dosDate, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true) // compressed size
    local.setUint32(22, data.length, true) // uncompressed size
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true) // extra field length

    parts.push(new Uint8Array(local.buffer), nameBytes, data)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true) // version made by
    central.setUint16(6, 20, true) // version needed
    central.setUint16(8, 0, true)
    central.setUint16(10, 0, true)
    central.setUint16(12, dosTime, true)
    central.setUint16(14, dosDate, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, data.length, true)
    central.setUint32(24, data.length, true)
    central.setUint16(28, nameBytes.length, true)
    central.setUint16(30, 0, true) // extra field length
    central.setUint16(32, 0, true) // comment length
    central.setUint16(34, 0, true) // disk number start
    central.setUint16(36, 0, true) // internal attrs
    central.setUint32(38, 0, true) // external attrs
    central.setUint32(42, offset, true) // local header offset

    centralParts.push(new Uint8Array(central.buffer), nameBytes)

    offset += local.buffer.byteLength + nameBytes.length + data.length
  }

  const centralStart = offset
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(4, 0, true)
  end.setUint16(6, 0, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, centralStart, true)
  end.setUint16(20, 0, true)

  return new Blob([...parts, ...centralParts, new Uint8Array(end.buffer)], { type: 'application/zip' })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
