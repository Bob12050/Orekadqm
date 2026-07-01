// 画面・ドット絵の不変仕様（§マスタープロンプト「一度決めたら変更しない」）。
// ここを変えると全アセット・全レイアウトが崩れる。

/** 論理解像度: 幅は360固定。 */
export const LOGICAL_WIDTH = 360

/** 論理解像度: 高さは端末比率に追従して 640〜800 にクランプ。 */
export const LOGICAL_HEIGHT_MIN = 640
export const LOGICAL_HEIGHT_MAX = 800

/** タイルは 32×32。 */
export const TILE = 32

/** キャラフレームは 96×96、足元基準点 (48,84)。 */
export const CHAR_FRAME = 96
export const CHAR_ANCHOR_X = 48
export const CHAR_ANCHOR_Y = 84

/**
 * ポーズアトラス: 1枚 384×1728px ＝ 横4列×縦18行。
 * 行の並び: down[idle2,walk4,attack4,cast4,hurt2,death4] → up同順 → left同順。
 * right は left の setFlipX(true)。frameIndex = 行番号*4 + フレーム番号。
 */
export const ATLAS_COLS = 4
export const ATLAS_ROWS = 18
export const ATLAS_WIDTH = CHAR_FRAME * ATLAS_COLS // 384
export const ATLAS_HEIGHT = CHAR_FRAME * ATLAS_ROWS // 1728

/** 各ポーズの行オフセット（向きごとに +6 行）。 */
export const POSE_ROW = {
  idle: 0,
  walk: 1,
  attack: 2,
  cast: 3,
  hurt: 4,
  death: 5,
} as const
export type PoseName = keyof typeof POSE_ROW

/** 向きごとの行ブロック先頭。right は left を反転して使う。 */
export const DIR_ROW_BASE = {
  down: 0,
  up: 6,
  left: 12,
  right: 12, // left を setFlipX(true)
} as const
export type Facing = keyof typeof DIR_ROW_BASE

/** ポーズごとのフレーム構成とアニメ定義。 */
export interface PoseSpec {
  readonly frames: number
  readonly fps: number
  readonly loop: boolean
}
export const POSE_SPECS: Record<PoseName, PoseSpec> = {
  idle: { frames: 2, fps: 3, loop: true },
  walk: { frames: 4, fps: 8, loop: true },
  attack: { frames: 4, fps: 14, loop: false },
  cast: { frames: 4, fps: 10, loop: false },
  hurt: { frames: 2, fps: 8, loop: false },
  death: { frames: 4, fps: 8, loop: false },
}

/** BASE_URL を前置した絶対アセットURLを返す（GitHub Pages のサブパス対策）。 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const clean = path.replace(/^\/+/, '')
  return base.endsWith('/') ? base + clean : `${base}/${clean}`
}
