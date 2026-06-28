// ダメージ・命中・会心・暴走の計算（設計書 5-10）。純関数。乱数は Rng 注入。
import type { Rng } from '../reel/seededRng'
import { elementResult, type Effectiveness } from './attributes'
import type { SkillDef } from './skills'
import type { BattleUnit, StatusKind } from './types'

/** 状態異常を反映した実効ステータス */
export function effStat(unit: BattleUnit, key: 'atk' | 'def' | 'mag' | 'spd' | 'acc'): number {
  let v = unit.base[key]
  for (const s of unit.statuses) {
    if (key === 'atk' && s.kind === 'atkUp') v *= s.magnitude
    if (key === 'atk' && s.kind === 'atkDown') v *= s.magnitude
    if (key === 'def' && s.kind === 'defUp') v *= s.magnitude
    if (key === 'def' && s.kind === 'defDown') v *= s.magnitude
    if (key === 'spd' && s.kind === 'haste') v *= s.magnitude
    if (key === 'spd' && s.kind === 'slow') v *= s.magnitude
  }
  return v
}

export function hasStatus(unit: BattleUnit, kind: StatusKind): boolean {
  return unit.statuses.some((s) => s.kind === kind)
}

export function critChance(unit: BattleUnit): number {
  return clamp(0.06 + unit.base.luck * 0.0025, 0.05, 0.35)
}

export function berserkChance(unit: BattleUnit): number {
  return clamp(0.03 + unit.base.luck * 0.0008, 0.02, 0.15)
}

/** 命中率（攻撃系のみ。回復/自己バフは常に命中） */
export function hitChance(actor: BattleUnit, target: BattleUnit): number {
  const accMod = (effStat(actor, 'acc') - 90) * 0.004
  const evade = (effStat(target, 'spd') - effStat(actor, 'spd')) * 0.001
  const blind = hasStatus(actor, 'blind') ? 0.3 : 0
  return clamp(0.92 + accMod - evade - blind, 0.5, 0.99)
}

export interface DamageResult {
  amount: number
  crit: boolean
  berserk: boolean
  effectiveness: Effectiveness
}

export function computeDamage(
  actor: BattleUnit,
  target: BattleUnit,
  skill: SkillDef,
  rng: Rng,
): DamageResult {
  const atk = skill.damageType === 'magic' ? effStat(actor, 'mag') : effStat(actor, 'atk')
  const def = effStat(target, 'def')
  const raw = skill.power * atk
  const mitigated = raw * (120 / (120 + def))
  const elem = elementResult(actor.attribute, target.attribute)
  const crit = rng() < critChance(actor)
  const berserk = rng() < berserkChance(actor)
  const variance = 0.9 + rng() * 0.2
  const amount = Math.max(
    1,
    Math.round(mitigated * elem.multiplier * (crit ? 1.8 : 1) * (berserk ? 2.5 : 1) * variance),
  )
  return { amount, crit, berserk, effectiveness: elem.effectiveness }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
