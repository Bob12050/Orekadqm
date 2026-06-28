// 種データ + レベルから戦闘ユニットを生成する。
import { getSpeciesById, toRuntimeReel } from '../data/monsters'
import type { Attribute, BattleUnit, Stats, UnitInit } from './types'

/** レベルによるステータス倍率（おだやかな線形成長） */
function levelFactor(level: number): number {
  return 1 + (level - 1) * 0.08
}

export function makeUnit(init: UnitInit): BattleUnit {
  const sp = getSpeciesById(init.speciesId)
  if (!sp) throw new Error(`unknown species: ${init.speciesId}`)
  const f = levelFactor(init.level)
  const base: Stats = {
    hp: Math.round(sp.stats.hp * f),
    atk: Math.round(sp.stats.atk * f),
    def: Math.round(sp.stats.def * f),
    mag: Math.round(sp.stats.mag * f),
    spd: Math.round(sp.stats.spd * f),
    acc: sp.stats.acc,
    luck: sp.stats.luck,
  }
  return {
    uid: `${init.side}-${init.slot}`,
    name: sp.name,
    speciesId: sp.id,
    side: init.side,
    slot: init.slot,
    attribute: sp.attribute as Attribute,
    base,
    hp: base.hp,
    maxHp: base.hp,
    reel: toRuntimeReel(sp),
    statuses: [],
    alive: true,
  }
}

export function makeParty(inits: UnitInit[]): BattleUnit[] {
  return inits.map(makeUnit)
}
