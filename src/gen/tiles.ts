// 地面タイルと装飾オブジェクトの手続き生成。控えめなディザで「そこまで荒くない」質感に。

import { TILE } from '../core/constants.ts'
import type { MapPalette } from '../data/types.ts'
import { blob, ellipse, makeCanvas, px, shade } from './pixel.ts'

// 位置から決定的な擬似乱数（Math.random 不使用でタイルを再現可能に）。
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >>> 13)) | 0
  h = Math.imul(h, 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** 96×96（3×3タイル）の地面パッチ。タイル境界が目立たないよう散りばめる。 */
export function buildGroundTexture(pal: MapPalette): HTMLCanvasElement {
  const size = TILE * 3
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const alt = pal.groundAlt
  const dark = shade(pal.ground, -0.12)
  const light = shade(pal.ground, 0.08)
  px(ctx, 0, 0, size, size, pal.ground)
  // 2px ブロックの微細な陰影ディザ
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const n = hash(x, y)
      if (n < 0.1) px(ctx, x, y, 2, 2, dark)
      else if (n < 0.2) px(ctx, x, y, 2, 2, light)
      else if (n < 0.27) px(ctx, x, y, 2, 2, alt)
    }
  }
  // アクセント（草/小石）を数点
  for (let ty = 0; ty < 3; ty++) {
    for (let tx = 0; tx < 3; tx++) {
      const n = hash(tx * 7 + 3, ty * 13 + 5)
      if (n > 0.55) {
        const ax = tx * TILE + 8 + Math.floor(n * 12)
        const ay = ty * TILE + 10 + Math.floor(hash(tx, ty) * 12)
        // 草の房
        px(ctx, ax, ay, 1, 4, pal.accent)
        px(ctx, ax + 2, ay + 1, 1, 3, shade(pal.accent, -0.1))
        px(ctx, ax - 2, ay + 1, 1, 3, shade(pal.accent, 0.1))
      }
    }
  }
  return canvas
}

/** マップ外周の縁（暗い土手）。 */
export function buildEdgeTexture(pal: MapPalette): HTMLCanvasElement {
  const canvas = makeCanvas(TILE, TILE)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  px(ctx, 0, 0, TILE, TILE, shade(pal.edge, 0))
  for (let y = 0; y < TILE; y += 2) {
    for (let x = 0; x < TILE; x += 2) {
      const n = hash(x + 99, y + 33)
      if (n < 0.2) px(ctx, x, y, 2, 2, shade(pal.edge, -0.2))
      else if (n < 0.35) px(ctx, x, y, 2, 2, shade(pal.edge, 0.12))
    }
  }
  return canvas
}

const DECO_OUTLINE = '#241a2a'

export function buildTree(): HTMLCanvasElement {
  const canvas = makeCanvas(48, 64)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ellipse(ctx, 24, 60, 12, 3, 'rgba(0,0,0,0.16)')
  // 幹
  blob(ctx, 21, 40, 6, 20, '#6b4a2e', DECO_OUTLINE, 0)
  // 葉（3段）
  blob(ctx, 8, 22, 32, 20, '#3f7d3a', DECO_OUTLINE, 3)
  blob(ctx, 12, 12, 24, 16, '#4c8f45', DECO_OUTLINE, 3)
  px(ctx, 16, 16, 8, 4, '#63a85a')
  return canvas
}

export function buildRock(): HTMLCanvasElement {
  const canvas = makeCanvas(40, 32)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ellipse(ctx, 20, 28, 12, 3, 'rgba(0,0,0,0.16)')
  blob(ctx, 8, 10, 24, 16, '#8a8f9a', DECO_OUTLINE, 2)
  px(ctx, 12, 13, 10, 4, '#a6acb6')
  px(ctx, 20, 18, 8, 5, '#6f747e')
  return canvas
}

export function buildHouse(): HTMLCanvasElement {
  const canvas = makeCanvas(64, 64)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ellipse(ctx, 32, 60, 22, 4, 'rgba(0,0,0,0.16)')
  // 壁
  blob(ctx, 12, 30, 40, 28, '#d8c39a', DECO_OUTLINE, 1)
  // 屋根
  ctx.fillStyle = DECO_OUTLINE
  for (let i = 0; i <= 24; i++) {
    const w = 44 - i * 1.7
    px(ctx, 32 - w / 2, 12 + i, w, 1, i % 2 === 0 ? '#b5533f' : '#a3492f')
  }
  // 扉
  blob(ctx, 28, 42, 10, 16, '#6b4a2e', DECO_OUTLINE, 0)
  px(ctx, 35, 50, 1, 2, '#ffd766')
  // 窓
  blob(ctx, 16, 36, 8, 8, '#8fd0e6', DECO_OUTLINE, 0)
  blob(ctx, 40, 36, 8, 8, '#8fd0e6', DECO_OUTLINE, 0)
  return canvas
}

/** マップ間の出口ゲート（光る石畳）。 */
export function buildPortal(color: string): HTMLCanvasElement {
  const canvas = makeCanvas(48, 48)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ellipse(ctx, 24, 40, 18, 5, 'rgba(0,0,0,0.18)')
  blob(ctx, 6, 20, 36, 22, shade(color, -0.1), DECO_OUTLINE, 3)
  ellipse(ctx, 24, 31, 12, 9, shade(color, 0.25))
  ellipse(ctx, 24, 31, 7, 5, '#ffffff')
  return canvas
}
