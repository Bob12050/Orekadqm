// 敵の完成済み単一スプライト（レイヤー合成しない）を手続き生成する。
// 96×96・足元基準 (48,84) でキャラと同じ配置ロジックに乗せる。
// 実PNG(public/assets/enemy/<sprite>.png)があれば Boot が優先する。

import { CHAR_ANCHOR_X, CHAR_ANCHOR_Y, CHAR_FRAME } from '../core/constants.ts'
import type { EnemyVisual } from '../data/types.ts'
import { blob, ellipse, ellipseOutlined, makeCanvas, px, shade } from './pixel.ts'

const OUTLINE = '#1c1626'

function drawSlime(ctx: CanvasRenderingContext2D, cx: number, fy: number, s: number, color: string): void {
  const r = s / 2
  const hi = shade(color, 0.22)
  const lo = shade(color, -0.2)
  // 下半分だけのドーム
  ctx.fillStyle = OUTLINE
  ellipse(ctx, cx, fy - r + 1, r + 1, r + 2, OUTLINE)
  ellipse(ctx, cx, fy - r, r, r + 1, color)
  // てかり
  ellipse(ctx, cx - r * 0.4, fy - r * 1.3, r * 0.4, r * 0.35, hi)
  // 底の陰
  px(ctx, cx - r, fy - 3, r * 2, 3, lo)
  // 目
  px(ctx, cx - r * 0.45, fy - r * 0.9, 3, 4, OUTLINE)
  px(ctx, cx + r * 0.2, fy - r * 0.9, 3, 4, OUTLINE)
  px(ctx, cx - r * 0.45, fy - r * 0.9, 1, 1, '#ffffff')
  px(ctx, cx + r * 0.2, fy - r * 0.9, 1, 1, '#ffffff')
}

function drawBeast(ctx: CanvasRenderingContext2D, cx: number, fy: number, s: number, color: string): void {
  const hi = shade(color, 0.18)
  const lo = shade(color, -0.22)
  const bodyW = s
  const bodyH = s * 0.55
  // 脚
  for (const lx of [-bodyW * 0.32, -bodyW * 0.1, bodyW * 0.12, bodyW * 0.3]) {
    blob(ctx, cx + lx, fy - 8, 4, 8, lo, OUTLINE, 0)
  }
  // 胴
  ellipseOutlined(ctx, cx, fy - bodyH * 0.7 - 6, bodyW * 0.5, bodyH * 0.5, color, OUTLINE)
  px(ctx, cx - bodyW * 0.4, fy - bodyH - 4, bodyW * 0.5, 3, hi)
  // 頭（前方＝左）
  const hx = cx - bodyW * 0.42
  ellipseOutlined(ctx, hx, fy - bodyH - 4, s * 0.24, s * 0.22, color, OUTLINE)
  // 耳
  blob(ctx, hx - 4, fy - bodyH - 14, 4, 6, color, OUTLINE, 0)
  blob(ctx, hx + 2, fy - bodyH - 14, 4, 6, color, OUTLINE, 0)
  // 鼻先
  blob(ctx, hx - s * 0.28, fy - bodyH - 2, 5, 4, lo, OUTLINE, 0)
  // 目
  px(ctx, hx - 3, fy - bodyH - 6, 2, 2, '#ffe14d')
  // しっぽ
  for (let i = 0; i < 5; i++) px(ctx, cx + bodyW * 0.45 + i, fy - bodyH - 4 - i, 2, 2, lo)
}

function drawFlyer(ctx: CanvasRenderingContext2D, cx: number, fy: number, s: number, color: string): void {
  const hi = shade(color, 0.2)
  const lo = shade(color, -0.25)
  const cy = fy - s * 0.7
  // 翼
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const wx = cx + dir * (4 + i * 5)
      const wh = 10 - i * 2
      blob(ctx, wx - (dir < 0 ? 5 : 0), cy - wh / 2 + i * 2, 5, wh, lo, OUTLINE, 0)
    }
  }
  // 胴
  ellipseOutlined(ctx, cx, cy, s * 0.24, s * 0.3, color, OUTLINE)
  px(ctx, cx - 3, cy - s * 0.2, 3, 5, hi)
  // 耳
  blob(ctx, cx - 4, cy - s * 0.4, 3, 5, color, OUTLINE, 0)
  blob(ctx, cx + 2, cy - s * 0.4, 3, 5, color, OUTLINE, 0)
  // 目
  px(ctx, cx - 3, cy - 2, 2, 2, '#ff5a5a')
  px(ctx, cx + 2, cy - 2, 2, 2, '#ff5a5a')
}

function drawGolem(ctx: CanvasRenderingContext2D, cx: number, fy: number, s: number, color: string): void {
  const hi = shade(color, 0.24)
  const lo = shade(color, -0.28)
  const bodyW = s * 0.8
  const bodyH = s * 0.9
  // 脚
  blob(ctx, cx - bodyW * 0.42, fy - 12, 10, 12, lo, OUTLINE, 0)
  blob(ctx, cx + bodyW * 0.18, fy - 12, 10, 12, lo, OUTLINE, 0)
  // 胴（ごつい）
  blob(ctx, cx - bodyW / 2, fy - bodyH, bodyW, bodyH - 8, color, OUTLINE, 2)
  px(ctx, cx - bodyW * 0.4, fy - bodyH + 4, bodyW * 0.28, bodyH * 0.5, hi)
  px(ctx, cx + bodyW * 0.14, fy - bodyH + 6, bodyW * 0.24, bodyH * 0.4, lo)
  // 灼熱の核
  ellipseOutlined(ctx, cx, fy - bodyH * 0.55, 6, 6, '#ffd25a', '#a83a12')
  ellipse(ctx, cx, fy - bodyH * 0.55, 3, 3, '#fff2b0')
  // 腕
  blob(ctx, cx - bodyW / 2 - 8, fy - bodyH + 6, 8, bodyH * 0.6, shade(color, -0.1), OUTLINE, 1)
  blob(ctx, cx + bodyW / 2, fy - bodyH + 6, 8, bodyH * 0.6, shade(color, -0.1), OUTLINE, 1)
  // 頭
  const hy = fy - bodyH - 6
  blob(ctx, cx - 10, hy - 12, 20, 16, color, OUTLINE, 2)
  // 角
  blob(ctx, cx - 12, hy - 20, 4, 10, hi, OUTLINE, 0)
  blob(ctx, cx + 8, hy - 20, 4, 10, hi, OUTLINE, 0)
  // 目
  px(ctx, cx - 6, hy - 6, 3, 3, '#fff2b0')
  px(ctx, cx + 3, hy - 6, 3, 3, '#fff2b0')
}

/** 敵1体のスプライトを生成。 */
export function buildEnemySprite(visual: EnemyVisual): HTMLCanvasElement {
  const canvas = makeCanvas(CHAR_FRAME, CHAR_FRAME)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const cx = CHAR_ANCHOR_X
  const fy = CHAR_ANCHOR_Y
  // 影
  ellipse(ctx, cx, fy + 2, visual.size * 0.5, 3.5, 'rgba(0,0,0,0.18)')
  switch (visual.shape) {
    case 'slime':
      drawSlime(ctx, cx, fy, visual.size, visual.color)
      break
    case 'beast':
      drawBeast(ctx, cx, fy, visual.size, visual.color)
      break
    case 'flyer':
      drawFlyer(ctx, cx, fy, visual.size, visual.color)
      break
    case 'golem':
      drawGolem(ctx, cx, fy, visual.size, visual.color)
      break
  }
  return canvas
}
