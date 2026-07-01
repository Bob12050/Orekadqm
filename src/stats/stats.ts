// 派生ステータス計算は computeDerived この1か所のみ（アーキ絶対ルール）。
// base(STR/VIT/INT/DEX/LUK)＋レベル＋職業補正＋装備＋パッシブ → 派生ステ。

import type { BaseStats, DerivedStats, EquipmentDef, JobDef } from '../data/types.ts'

const ZERO: BaseStats = { str: 0, vit: 0, int: 0, dex: 0, luk: 0 }

export function addStats(a: BaseStats, b: Partial<BaseStats>): BaseStats {
  return {
    str: a.str + (b.str ?? 0),
    vit: a.vit + (b.vit ?? 0),
    int: a.int + (b.int ?? 0),
    dex: a.dex + (b.dex ?? 0),
    luk: a.luk + (b.luk ?? 0),
  }
}

function mulStats(a: BaseStats, k: number): BaseStats {
  return { str: a.str * k, vit: a.vit * k, int: a.int * k, dex: a.dex * k, luk: a.luk * k }
}

/**
 * 職業・レベル・装備・パッシブから最終の一次ステータスを合成する。
 * 見た目は職業固定なので装備は statMods（性能）のみ寄与する。
 */
export function aggregateBaseStats(input: {
  job: JobDef
  level: number
  playerBase?: Partial<BaseStats>
  equipment: readonly EquipmentDef[]
  passives?: readonly Partial<BaseStats>[]
}): BaseStats {
  const levelGrowth = mulStats(input.job.statGrowth, Math.max(0, input.level - 1))
  let base = addStats(input.job.statBase, levelGrowth)
  base = addStats(base, input.playerBase ?? {})
  for (const eq of input.equipment) base = addStats(base, eq.statMods)
  for (const p of input.passives ?? []) base = addStats(base, p)
  return base
}

/** 装備由来の派生ステ直接加算を合算する。 */
export function aggregateDerivedMods(
  equipment: readonly EquipmentDef[],
): Partial<DerivedStats> {
  const acc: Partial<DerivedStats> = {}
  const keys: (keyof DerivedStats)[] = [
    'maxHp',
    'maxMp',
    'physAtk',
    'magAtk',
    'def',
    'magDef',
    'accuracy',
    'evasion',
    'critRate',
    'atkSpeed',
    'moveSpeed',
  ]
  for (const eq of equipment) {
    if (!eq.derivedMods) continue
    for (const k of keys) {
      const v = eq.derivedMods[k]
      if (v !== undefined) acc[k] = (acc[k] ?? 0) + v
    }
  }
  return acc
}

/**
 * 唯一の派生ステータス計算。整数丸めして返す（critRate/atkSpeed は小数を保つ）。
 */
export function computeDerived(
  base: BaseStats,
  level: number,
  derivedMods: Partial<DerivedStats> = {},
): DerivedStats {
  const { str, vit, int: intel, dex, luk } = base
  const d: DerivedStats = {
    maxHp: Math.round(30 + vit * 6 + level * 8),
    maxMp: Math.round(10 + intel * 4 + level * 3),
    physAtk: Math.round(str * 2 + dex * 0.5),
    magAtk: Math.round(intel * 2 + luk * 0.3),
    def: Math.round(vit * 1 + level * 0.5),
    magDef: Math.round(intel * 0.8 + vit * 0.4),
    accuracy: Math.round(80 + dex * 1.5),
    evasion: Math.round(dex * 1.0 + luk * 0.5),
    critRate: Math.min(0.6, 0.03 + luk * 0.004 + dex * 0.001),
    atkSpeed: Math.min(3, 1.0 + dex * 0.01),
    moveSpeed: Math.round(96 + dex * 0.6),
  }
  // 装備の直接加算を上乗せ
  d.maxHp += Math.round(derivedMods.maxHp ?? 0)
  d.maxMp += Math.round(derivedMods.maxMp ?? 0)
  d.physAtk += Math.round(derivedMods.physAtk ?? 0)
  d.magAtk += Math.round(derivedMods.magAtk ?? 0)
  d.def += Math.round(derivedMods.def ?? 0)
  d.magDef += Math.round(derivedMods.magDef ?? 0)
  d.accuracy += Math.round(derivedMods.accuracy ?? 0)
  d.evasion += Math.round(derivedMods.evasion ?? 0)
  d.critRate = Math.min(0.8, d.critRate + (derivedMods.critRate ?? 0))
  d.atkSpeed = Math.min(3, d.atkSpeed + (derivedMods.atkSpeed ?? 0))
  d.moveSpeed += Math.round(derivedMods.moveSpeed ?? 0)
  return d
}

/** 敵の一次ステから派生ステを作る簡易版（敵はレベル＝そのまま）。 */
export function computeEnemyDerived(base: BaseStats, level: number): DerivedStats {
  return computeDerived(base, level)
}

export { ZERO as ZERO_STATS }
