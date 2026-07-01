// ダメージ計算。純TS。属性倍率・会心・状態異常判定を1か所に集約する。

import type { Rng } from './rng.ts'
import {
  elementMultiplier,
  rollAilment,
  type Ailment,
  type Element,
  type EnemyElementProfile,
} from './elements.ts'

export interface Attacker {
  atk: number
  critRate: number
  /** 攻撃の属性（skill.element 優先 → 武器属性）。 */
  element: Element
  /** スキル威力係数（通常攻撃は 1）。 */
  power: number
}

export interface Defender {
  def: number
  profile: EnemyElementProfile
}

export interface HitResult {
  amount: number
  crit: boolean
  element: Element
  ailment: Ailment | null
}

/** 1回の命中のダメージ・会心・状態異常を解決する。 */
export function resolveHit(attacker: Attacker, defender: Defender, rng: Rng): HitResult {
  const raw = attacker.atk * attacker.power - defender.def * 0.5
  const base = Math.max(1, raw)
  // ±10% の振れ
  const variance = 0.9 + rng.next() * 0.2
  const elemMult = elementMultiplier(attacker.element, defender.profile)
  const crit = rng.chance(attacker.critRate)
  const critMult = crit ? 1.6 : 1
  const amount = Math.max(1, Math.round(base * variance * elemMult * critMult))
  const ailment = rollAilment(attacker.element, defender.profile, rng.next())
  return { amount, crit, element: attacker.element, ailment }
}
