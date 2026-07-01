// PWA アイコンPNGを生成する（依存なしの最小PNGエンコーダ）。
// ドット感のあるエンブレム（剣＋星）を描いて public/icons に出力する。

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)))
  const body = new Uint8Array(typeBytes.length + data.length)
  body.set(typeBytes, 0)
  body.set(data, typeBytes.length)
  const len = data.length
  const out = new Uint8Array(8 + body.length + 4)
  out[0] = (len >>> 24) & 0xff
  out[1] = (len >>> 16) & 0xff
  out[2] = (len >>> 8) & 0xff
  out[3] = len & 0xff
  out.set(body, 4)
  const crc = crc32(body)
  const off = 4 + body.length
  out[off] = (crc >>> 24) & 0xff
  out[off + 1] = (crc >>> 16) & 0xff
  out[off + 2] = (crc >>> 8) & 0xff
  out[off + 3] = crc & 0xff
  return out
}

function encodePng(size: number, rgba: Uint8Array): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, size)
  dv.setUint32(4, size)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // 10,11,12 = 0 (compression, filter, interlace)
  // フィルタバイト付きスキャンライン
  const raw = new Uint8Array(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1)
  }
  const idat = deflateSync(raw)
  return concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))])
}

function concat(arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrs) {
    out.set(a, off)
    off += a.length
  }
  return out
}

function draw(size: number): Uint8Array {
  const rgba = new Uint8Array(size * size * 4)
  const set = (x: number, y: number, r: number, g: number, b: number): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    rgba[i] = r
    rgba[i + 1] = g
    rgba[i + 2] = b
    rgba[i + 3] = 255
  }
  const px = size / 24 // 24x24 ドットのエンブレム
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 背景（縦グラデ風の2段）
      const top = y < size / 2
      set(x, y, top ? 0x27 : 0x1b, top ? 0x1b : 0x10, top ? 0x3a : 0x30)
    }
  }
  const block = (gx: number, gy: number, r: number, g: number, b: number): void => {
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) set(Math.floor(gx * px + dx), Math.floor(gy * px + dy), r, g, b)
  }
  // 剣（縦）
  for (let gy = 4; gy <= 15; gy++) block(11, gy, 0xe8, 0xe2, 0xf0)
  for (let gy = 4; gy <= 15; gy++) block(12, gy, 0xc8, 0xc0, 0xd8)
  block(11, 3, 0xff, 0xf2, 0xe6)
  block(12, 3, 0xff, 0xf2, 0xe6)
  // つば
  for (let gx = 8; gx <= 15; gx++) block(gx, 16, 0xd9, 0xb4, 0x4a)
  // 柄
  block(11, 17, 0x6b, 0x4a, 0x2e)
  block(12, 17, 0x6b, 0x4a, 0x2e)
  block(11, 18, 0x6b, 0x4a, 0x2e)
  block(12, 18, 0x6b, 0x4a, 0x2e)
  // 星（右上）
  const star: [number, number][] = [[17, 4], [16, 5], [18, 5], [15, 6], [19, 6], [16, 6], [18, 6], [17, 5], [17, 6], [17, 7], [16, 7], [18, 7]]
  for (const [gx, gy] of star) block(gx, gy, 0xff, 0xe1, 0x4d)
  return rgba
}

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), encodePng(size, draw(size)))
  console.log(`wrote icon-${size}.png`)
}
