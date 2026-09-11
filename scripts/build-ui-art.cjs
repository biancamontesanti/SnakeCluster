// Code-native UI primitives: actual alpha keeps round artwork round on mobile,
// where React-ECS borderRadius is not supported. No source artwork is modified.
const { deflateSync } = require('node:zlib')
const { writeFileSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
const destination = join(__dirname, '../assets/images/ui')
mkdirSync(destination, { recursive: true })
function crc32(bytes) {
  let crc = -1
  for (const byte of bytes) { crc ^= byte; for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) }
  return (crc ^ -1) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type), out = Buffer.alloc(data.length + 12)
  out.writeUInt32BE(data.length); name.copy(out, 4); data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), out.length - 4)
  return out
}
function png(name, width, height, pixel) {
  const data = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rgba = pixel((x + .5) / width, (y + .5) / height)
    rgba.forEach((v, i) => data[y * (width * 4 + 1) + 1 + x * 4 + i] = Math.round(Math.max(0, Math.min(255, v))))
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6
  writeFileSync(join(destination, name), Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]))
}
png('orb.png', 128, 128, (u, v) => {
  const x = (u - .5) * 2, y = (v - .5) * 2, r = Math.hypot(x, y)
  const highlight = Math.exp(-((x + .33) ** 2 + (y + .4) ** 2) * 12)
  const c = 170 + 60 * Math.sqrt(Math.max(0, 1 - r * r)) + highlight * 42 - y * 12
  return [c, c, c, (1 - r) * 128 * 255]
})
png('lock.png', 96, 96, (u, v) => {
  const ring = Math.hypot((u - .5), (v - .34))
  const shackle = v < .42 && ring > .17 && ring < .25
  const body = u > .17 && u < .83 && v >= .4 && v < .83 && (v < .68 || Math.hypot((u - .5) / .33, (v - .68) / .17) < 1)
  const key = Math.hypot(u - .5, v - .58) < .065 || (Math.abs(u - .5) < .03 && v > .58 && v < .72)
  return shackle ? [234, 247, 218, 255] : body && !key ? [189, 240, 86, 255] : [0, 0, 0, 0]
})
png('growth.png', 256, 8, (u) => [50 + u * 143, 132 + u * 106, 58 + u * 18, 255])

function roundedBlackPanel(name, width, height, radius) {
  png(name, width, height, (u, v) => {
    const x = Math.abs((u - .5) * width) - (width / 2 - radius - 1)
    const y = Math.abs((v - .5) * height) - (height / 2 - radius - 1)
    const distance = Math.hypot(Math.max(0, x), Math.max(0, y)) + Math.min(Math.max(x, y), 0) - radius
    return [0, 0, 0, Math.max(0, Math.min(1, .5 - distance)) * 190]
  })
}
roundedBlackPanel('portrait-black-rounded.png', 256, 256, 48)
roundedBlackPanel('name-black-rounded.png', 512, 144, 56)

// White outlined upward boost arrow, with a second chevron. The Explorer
// supplies the native circular button; this PNG supplies only its glyph.
const boostPaths = [
  [[.25, .36], [.5, .09], [.75, .36]],
  [[.5, .31], [.75, .61], [.61, .61], [.61, .89], [.39, .89], [.39, .61], [.25, .61], [.5, .31]]
]
png('boost-up.png', 256, 256, (u, v) => {
  let distance = Infinity
  for (const points of boostPaths) for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i]
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)))
    distance = Math.min(distance, Math.hypot(u - ax - dx * t, v - ay - dy * t))
  }
  return [255, 255, 255, Math.max(0, Math.min(1, (.021 - distance) * 256)) * 255]
})
