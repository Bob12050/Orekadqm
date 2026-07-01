// 属性・状態異常ロジック（Phase 1 から実データで使う。純TS・そのまま移植可）。
// 火/氷/雷/毒/聖/闇＋無。弱点 ×1.5 / 耐性 ×0.5。

export const ELEMENTS = ['none', 'fire', 'ice', 'thunder', 'poison', 'holy', 'dark'] as const
export type Element = (typeof ELEMENTS)[number]

export function isElement(v: string): v is Element {
  return (ELEMENTS as readonly string[]).includes(v)
}

/** ダメージ数字の属性色（HEX）。 */
export const ELEMENT_COLOR: Record<Element, number> = {
  none: 0xffffff,
  fire: 0xff6a3d,
  ice: 0x66d9ff,
  thunder: 0xffe14d,
  poison: 0xb06bff,
  holy: 0xfff2a8,
  dark: 0x9a6bd6,
}

/** 属性ヒット時に付与される状態異常。 */
export const STATUS_AILMENTS = ['burn', 'freeze', 'poisoned', 'paralyze'] as const
export type Ailment = (typeof STATUS_AILMENTS)[number]

export interface AilmentSpec {
  /** DoT なら 500ms 刻みのダメージ、行動停止系なら 0。 */
  readonly dotPerTick: number
  /** 効果の総時間 (ms)。 */
  readonly durationMs: number
  /** 行動停止するか。 */
  readonly stun: boolean
}

export const AILMENT_SPECS: Record<Ailment, AilmentSpec> = {
  burn: { dotPerTick: 4, durationMs: 3000, stun: false },
  poisoned: { dotPerTick: 3, durationMs: 5000, stun: false },
  freeze: { dotPerTick: 0, durationMs: 1500, stun: true },
  paralyze: { dotPerTick: 0, durationMs: 1200, stun: true },
}

/** 属性 → 誘発しうる状態異常。 */
export const ELEMENT_AILMENT: Partial<Record<Element, Ailment>> = {
  fire: 'burn',
  ice: 'freeze',
  thunder: 'paralyze',
  poison: 'poisoned',
}

export const DOT_TICK_MS = 500
/** 状態異常の基本発生率。弱点時は 1.5 倍。 */
export const BASE_AILMENT_RATE = 0.28

export interface EnemyElementProfile {
  readonly weakness?: Element
  readonly resist?: Element
}

/** 属性倍率。弱点 ×1.5 / 耐性 ×0.5 / それ以外 ×1。 */
export function elementMultiplier(attack: Element, target: EnemyElementProfile): number {
  if (attack === 'none') return 1
  if (target.weakness === attack) return 1.5
  if (target.resist === attack) return 0.5
  return 1
}

/** この攻撃で状態異常が発生するか、発生するなら種別を返す。 */
export function rollAilment(
  attack: Element,
  target: EnemyElementProfile,
  roll: number,
): Ailment | null {
  const ailment = ELEMENT_AILMENT[attack]
  if (!ailment) return null
  const rate = target.weakness === attack ? BASE_AILMENT_RATE * 1.5 : BASE_AILMENT_RATE
  return roll < rate ? ailment : null
}
