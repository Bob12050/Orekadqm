// 職業固定のチビキャラを 384×1728 ポーズアトラスとして手続き生成する。
// 行: down[idle2,walk4,attack4,cast4,hurt2,death4] → up → left。right は実行時反転。
// 実PNG(public/assets/char/<key>.png)があれば Boot がそちらを優先し、これは使われない。

import {
  ATLAS_HEIGHT,
  ATLAS_WIDTH,
  CHAR_ANCHOR_X,
  CHAR_ANCHOR_Y,
  CHAR_FRAME,
  DIR_ROW_BASE,
  POSE_SPECS,
  type Facing,
  type PoseName,
} from '../core/constants.ts'
import { blob, ellipse, makeCanvas, px, shade } from './pixel.ts'

type WeaponKind = 'sword' | 'staff' | 'mace' | 'dagger' | 'whip' | 'none'

interface CharPalette {
  skin: string
  hair: string
  cloth: string
  trim: string
  accent: string
  outline: string
  weapon: WeaponKind
}

const DEFAULT: CharPalette = {
  skin: '#f2c9a0',
  hair: '#5a4632',
  cloth: '#d9cbb2',
  trim: '#b7a684',
  accent: '#8a7a5c',
  outline: '#2a2233',
  weapon: 'none',
}

const PALETTES: Record<string, CharPalette> = {
  char_base: DEFAULT,
  char_warrior: { skin: '#f2c9a0', hair: '#6b4a2a', cloth: '#c0392b', trim: '#7c2a1e', accent: '#c8c8d0', outline: '#2a1620', weapon: 'sword' },
  char_mage: { skin: '#f2c9a0', hair: '#3a2f5a', cloth: '#3a5bbf', trim: '#27407f', accent: '#ffd766', outline: '#1c1830', weapon: 'staff' },
  char_priest: { skin: '#f2c9a0', hair: '#caa15a', cloth: '#ece3d0', trim: '#d9b44a', accent: '#f0d98a', outline: '#3a3126', weapon: 'mace' },
  char_thief: { skin: '#f2c9a0', hair: '#2a2a2a', cloth: '#2f6b4a', trim: '#1e4a33', accent: '#c8c8d0', outline: '#182620', weapon: 'dagger' },
  char_tamer: { skin: '#f2c9a0', hair: '#8a5a3a', cloth: '#2fa89a', trim: '#1e7a6f', accent: '#ffcf6b', outline: '#183028', weapon: 'whip' },
}

interface PoseState {
  bob: number
  lean: number
  arm: number
  legL: number
  legR: number
  sink: number
  alpha: number
  pose: PoseName
  frame: number
}

const POSE_ORDER: PoseName[] = ['idle', 'walk', 'attack', 'cast', 'hurt', 'death']

function poseState(pose: PoseName, frame: number): PoseState {
  const s: PoseState = { bob: 0, lean: 0, arm: 0, legL: 0, legR: 0, sink: 0, alpha: 1, pose, frame }
  switch (pose) {
    case 'idle':
      s.bob = frame === 1 ? 1 : 0
      break
    case 'walk': {
      const lift = [0, 2, 0, 2][frame] ?? 0
      s.legL = frame === 1 ? lift : 0
      s.legR = frame === 3 ? lift : 0
      s.bob = frame % 2 === 1 ? 1 : 0
      break
    }
    case 'attack':
      s.lean = [0, 4, 7, 3][frame] ?? 0
      s.arm = [0, -6, 7, 2][frame] ?? 0
      break
    case 'cast':
      s.arm = [-4, -8, -8, -4][frame] ?? -6
      s.bob = frame % 2 === 1 ? 1 : 0
      break
    case 'hurt':
      s.lean = frame === 0 ? -5 : -2
      break
    case 'death':
      s.sink = frame * 4
      s.alpha = Math.max(0, 1 - frame * 0.24)
      break
  }
  return s
}

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, feetY: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ellipse(ctx, cx, feetY + 2, 12, 3, 'rgba(0,0,0,0.16)')
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  p: CharPalette,
  x: number,
  y: number,
  active: boolean,
): void {
  const o = p.outline
  switch (p.weapon) {
    case 'sword':
      blob(ctx, x, y - (active ? 12 : 6), 3, active ? 16 : 12, p.accent, o, 0)
      px(ctx, x - 1, y + (active ? 3 : 5), 5, 2, p.trim)
      break
    case 'dagger':
      blob(ctx, x, y - 2, 2, 9, p.accent, o, 0)
      px(ctx, x - 1, y + 6, 4, 2, p.trim)
      break
    case 'staff':
      blob(ctx, x + 1, y - 16, 2, 24, shade(p.trim, -0.1), o, 0)
      blob(ctx, x - 1, y - 20, 6, 6, p.accent, o, 1)
      break
    case 'mace':
      blob(ctx, x + 1, y - 6, 2, 14, p.trim, o, 0)
      blob(ctx, x - 1, y - 10, 6, 6, p.accent, o, 1)
      break
    case 'whip':
      px(ctx, x, y - 2, 2, 4, p.trim)
      for (let i = 0; i < 6; i++) px(ctx, x + 2 + i, y + 2 + i, 2, 1, p.accent)
      break
    case 'none':
      break
  }
}

function drawChibi(
  ctx: CanvasRenderingContext2D,
  cx: number,
  feetY: number,
  p: CharPalette,
  facing: Facing,
  st: PoseState,
): void {
  ctx.globalAlpha = st.alpha
  drawShadow(ctx, cx, feetY)

  const o = p.outline
  const clothLo = shade(p.cloth, -0.2)
  const clothHi = shade(p.cloth, 0.18)
  const skinLo = shade(p.skin, -0.15)
  const hairHi = shade(p.hair, 0.2)

  const fy = feetY + st.sink
  // 横方向のリーン（左向きは前方=左、それ以外は微小）
  const dx = facing === 'left' ? -st.lean : 0
  const dip = facing === 'left' ? 0 : Math.round(st.lean * 0.4)

  // 足
  const legY = fy - 10
  const legTopL = legY - st.legL
  const legTopR = legY - st.legR
  blob(ctx, cx - 6 + dx, legTopL, 5, 10 + (fy - legTopL - (fy - legY)), shade(p.trim, -0.1), o, 0)
  blob(ctx, cx + 1 + dx, legTopR, 5, 10, shade(p.trim, -0.1), o, 0)

  // 胴（チュニック）
  const bodyTop = fy - 28 + st.bob + dip
  blob(ctx, cx - 9 + dx, bodyTop, 18, 18, p.cloth, o, 1)
  px(ctx, cx - 7 + dx, bodyTop + 2, 3, 12, clothHi) // 左のハイライト帯
  px(ctx, cx + 4 + dx, bodyTop + 4, 3, 11, clothLo) // 右のシェード
  px(ctx, cx - 9 + dx, bodyTop + 13, 18, 3, p.trim) // 裾のトリム

  // 腕
  const armY = bodyTop + 3
  // 奥腕
  blob(ctx, cx + 7 + dx, armY - Math.max(0, st.arm), 4, 12, skinLo, o, 0)
  // 手前腕（武器を持つ側）
  const frontArmY = armY - Math.max(0, -st.arm) + (st.arm < 0 ? st.arm : 0)
  blob(ctx, cx - 11 + dx, frontArmY, 4, 12, p.skin, o, 0)

  // 頭
  const headH = 20
  const headTop = bodyTop - headH + 2
  const headX = cx - 11 + dx
  blob(ctx, headX, headTop, 22, headH, p.skin, o, 2)
  // 頬の陰
  px(ctx, headX + 17, headTop + 8, 3, 8, skinLo)

  // 髪
  blob(ctx, headX - 1, headTop - 2, 24, 8, p.hair, o, 1)
  px(ctx, headX + 1, headTop - 1, 8, 2, hairHi)
  if (facing === 'up') {
    // 後頭部：髪を広めに
    blob(ctx, headX, headTop + 4, 22, 12, p.hair, o, 1)
    px(ctx, headX + 3, headTop + 6, 6, 3, hairHi)
  } else {
    // 前髪
    px(ctx, headX, headTop + 4, 22, 3, shade(p.hair, -0.1))
    // 目
    const eyeY = headTop + 10
    if (facing === 'left') {
      px(ctx, headX + 4, eyeY, 2, 3, o)
    } else {
      px(ctx, headX + 5, eyeY, 2, 3, o)
      px(ctx, headX + 14, eyeY, 2, 3, o)
      // ほお
      px(ctx, headX + 3, eyeY + 3, 2, 1, shade(p.skin, -0.08))
      px(ctx, headX + 16, eyeY + 3, 2, 1, shade(p.skin, -0.08))
    }
  }

  // 武器（手前腕の手元）
  if (p.weapon !== 'none') {
    const wx = cx - 12 + dx
    const wy = frontArmY + 10
    const active = st.pose === 'attack' || st.pose === 'cast'
    drawWeapon(ctx, p, wx, wy, active)
  }

  ctx.globalAlpha = 1
}

/** 職業アトラスを生成して canvas を返す。 */
export function buildCharacterAtlas(appearance: string): HTMLCanvasElement {
  const p = PALETTES[appearance] ?? DEFAULT
  const canvas = makeCanvas(ATLAS_WIDTH, ATLAS_HEIGHT)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const dirs: Facing[] = ['down', 'up', 'left']
  for (const facing of dirs) {
    const base = DIR_ROW_BASE[facing]
    POSE_ORDER.forEach((pose, poseIdx) => {
      const row = base + poseIdx
      const spec = POSE_SPECS[pose]
      for (let col = 0; col < 4; col++) {
        const frame = Math.min(col, spec.frames - 1)
        const ox = col * CHAR_FRAME
        const oy = row * CHAR_FRAME
        const cx = ox + CHAR_ANCHOR_X
        const feetY = oy + CHAR_ANCHOR_Y
        drawChibi(ctx, cx, feetY, p, facing, poseState(pose, frame))
      }
    })
  }
  return canvas
}

export const CHARACTER_KEYS = Object.keys(PALETTES)
