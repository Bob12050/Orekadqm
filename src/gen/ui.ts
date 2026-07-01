// 操作UI（仮想スティック・ボタン）とアイテム/装備アイコンの手続き生成。

import { blob, ellipse, ellipseOutlined, makeCanvas, px, shade } from './pixel.ts'
import type { EquipSlot, ItemKind, Rarity } from '../data/types.ts'

/** レア度→色帯（R1〜R10）。 */
export const RARITY_COLOR: Record<number, string> = {
  1: '#b7c0cc',
  2: '#8fd06a',
  3: '#5aa9e6',
  4: '#b57ce6',
  5: '#e6a54c',
  6: '#e66a6a',
  7: '#ffd25a',
  8: '#66e6c8',
  9: '#ff8fd0',
  10: '#ffffff',
}

export function rarityColor(r: Rarity): string {
  return RARITY_COLOR[r] ?? '#b7c0cc'
}

export function buildStickBase(): HTMLCanvasElement {
  const c = makeCanvas(112, 112)
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ellipse(ctx, 56, 56, 52, 52, 'rgba(20,14,32,0.35)')
  ellipse(ctx, 56, 56, 48, 48, 'rgba(60,48,88,0.35)')
  ellipse(ctx, 56, 56, 46, 46, 'rgba(30,22,46,0.3)')
  return c
}

export function buildStickKnob(): HTMLCanvasElement {
  const c = makeCanvas(56, 56)
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ellipseOutlined(ctx, 28, 28, 22, 22, '#cbb8f0', '#2a2233')
  ellipse(ctx, 22, 22, 8, 8, '#eadfff')
  return c
}

function roundButton(color: string, glyph: (ctx: CanvasRenderingContext2D) => void, size = 72): HTMLCanvasElement {
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d')
  if (!ctx) return c
  const cx = size / 2
  ellipse(ctx, cx, cx + 2, cx - 4, cx - 4, 'rgba(0,0,0,0.25)')
  ellipseOutlined(ctx, cx, cx, cx - 5, cx - 5, color, '#1c1626')
  ellipse(ctx, cx - 6, cx - 6, 8, 6, shade(color, 0.3))
  glyph(ctx)
  return c
}

/** 攻撃ボタン（剣アイコン）。 */
export function buildAttackButton(): HTMLCanvasElement {
  return roundButton('#e0563f', (ctx) => {
    px(ctx, 34, 20, 4, 24, '#fff2e6')
    px(ctx, 30, 40, 12, 3, '#d9b44a')
    px(ctx, 35, 44, 2, 6, '#d9b44a')
  })
}

/** スキルボタン（星アイコン）。 */
export function buildSkillButton(): HTMLCanvasElement {
  return roundButton('#3a5bbf', (ctx) => {
    const pts = [
      [36, 18],
      [40, 32],
      [52, 32],
      [42, 40],
      [46, 52],
      [36, 44],
      [26, 52],
      [30, 40],
      [20, 32],
      [32, 32],
    ]
    ctx.fillStyle = '#ffe14d'
    ctx.beginPath()
    ctx.moveTo(pts[0]![0], pts[0]![1])
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1])
    ctx.closePath()
    ctx.fill()
  }, 60)
}

/** 調べるボタン（！/虫めがね）。 */
export function buildExamineButton(): HTMLCanvasElement {
  return roundButton('#2fa89a', (ctx) => {
    ellipseOutlined(ctx, 30, 28, 8, 8, '#eafcf7', '#1c1626')
    px(ctx, 34, 34, 3, 8, '#eafcf7')
  }, 56)
}

function iconBase(rarity: Rarity): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = makeCanvas(36, 36)
  const ctx = c.getContext('2d')!
  const rc = rarityColor(rarity)
  blob(ctx, 2, 2, 32, 32, '#241d33', shade(rc, -0.3), 2)
  px(ctx, 4, 4, 28, 28, '#181227')
  // レア度の色帯（下辺）
  px(ctx, 3, 31, 30, 3, rc)
  return { c, ctx }
}

/** アイテムアイコン（種別ごとの絵）。 */
export function buildItemIcon(kind: ItemKind, color: string, rarity: Rarity): HTMLCanvasElement {
  const { c, ctx } = iconBase(rarity)
  const cx = 18
  if (kind === 'consumable') {
    // ポーション瓶
    blob(ctx, 13, 14, 10, 14, color, '#12101c', 1)
    ellipse(ctx, 16, 18, 2, 3, shade(color, 0.35))
    px(ctx, 15, 9, 6, 6, '#b7a684')
    px(ctx, 14, 8, 8, 2, '#8a7a5c')
  } else if (kind === 'key') {
    ellipseOutlined(ctx, cx, 14, 5, 5, color, '#12101c')
    px(ctx, cx - 1, 18, 2, 12, color)
    px(ctx, cx + 1, 26, 4, 2, color)
  } else {
    // 素材：結晶
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(cx, 8)
    ctx.lineTo(26, 18)
    ctx.lineTo(cx, 30)
    ctx.lineTo(10, 18)
    ctx.closePath()
    ctx.fill()
    px(ctx, cx - 4, 14, 3, 8, shade(color, 0.3))
    px(ctx, cx + 2, 16, 2, 8, shade(color, -0.25))
  }
  return c
}

const SLOT_GLYPH: Record<EquipSlot, string> = {
  head: 'helm',
  body: 'armor',
  hands: 'glove',
  waist: 'belt',
  feet: 'boot',
  back: 'shield',
  weapon: 'weapon',
  acc1: 'ring',
  acc2: 'charm',
}

/** 装備アイコン（スロットごとの絵）。 */
export function buildEquipIcon(slot: EquipSlot, color: string, rarity: Rarity): HTMLCanvasElement {
  const { c, ctx } = iconBase(rarity)
  const g = SLOT_GLYPH[slot]
  const o = '#12101c'
  const hi = shade(color, 0.28)
  switch (g) {
    case 'weapon':
      px(ctx, 17, 8, 3, 18, '#e8e2f0')
      px(ctx, 13, 22, 11, 3, color)
      px(ctx, 17, 25, 3, 5, hi)
      break
    case 'shield':
      blob(ctx, 11, 9, 14, 18, color, o, 2)
      px(ctx, 17, 12, 2, 12, hi)
      break
    case 'armor':
      blob(ctx, 10, 10, 16, 16, color, o, 2)
      px(ctx, 10, 10, 5, 5, '#181227')
      px(ctx, 21, 10, 5, 5, '#181227')
      px(ctx, 16, 12, 4, 12, hi)
      break
    case 'helm':
      blob(ctx, 11, 12, 14, 10, color, o, 3)
      px(ctx, 11, 20, 14, 4, shade(color, -0.2))
      px(ctx, 16, 14, 4, 6, hi)
      break
    case 'boot':
      blob(ctx, 13, 10, 7, 14, color, o, 1)
      blob(ctx, 13, 22, 14, 5, color, o, 1)
      break
    case 'glove':
      blob(ctx, 12, 12, 12, 12, color, o, 2)
      px(ctx, 12, 10, 3, 5, color)
      px(ctx, 21, 10, 3, 5, color)
      break
    case 'belt':
      px(ctx, 8, 16, 20, 6, color)
      blob(ctx, 15, 15, 6, 8, hi, o, 1)
      break
    case 'ring':
      ellipseOutlined(ctx, 18, 20, 6, 6, '#3a3348', o)
      ellipse(ctx, 18, 20, 3, 3, '#181227')
      blob(ctx, 15, 10, 6, 6, color, o, 1)
      break
    case 'charm':
      ellipseOutlined(ctx, 18, 20, 7, 7, color, o)
      ellipse(ctx, 18, 20, 3, 3, hi)
      px(ctx, 17, 8, 2, 6, '#8a7a5c')
      break
  }
  return c
}
