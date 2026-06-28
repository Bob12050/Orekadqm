// 種データ + レベルから戦闘ユニットを生成する。
import { getSpeciesById, toRuntimeReel } from '../data/monsters'
import type { OwnedMonster } from '../state/collection'
import type { Attribute, BattleUnit, Stats, UnitInit } from './types'

/** レベルによるステータス倍率（おだやかな線形成長） */
function levelFactor(level: number): number {
  return 1 + (level - 1) * 0.08
}

function scaledStats(speciesId: number, level: number): Stats {
  const sp = getSpeciesById(speciesId)!
  const f = levelFactor(level)
  return {
    hp: Math.round(sp.stats.hp * f),
    atk: Math.round(sp.stats.atk * f),
    def: Math.round(sp.stats.def * f),
    mag: Math.round(sp.stats.mag * f),
    spd: Math.round(sp.stats.spd * f),
    acc: sp.stats.acc,
    luck: sp.stats.luck,
  }
}

/** 所持個体(育ったリール持ち)から味方バトルユニットを生成 */
export function makeUnitFromOwned(owned: OwnedMonster, slot: number): BattleUnit {
  const sp = getSpeciesById(owned.speciesId)
  if (!sp) throw new Error(`unknown species: ${owned.speciesId}`)
  const base = scaledStats(owned.speciesId, owned.level)
  return {
    uid: `ally-${slot}`,
    name: owned.name,
    speciesId: owned.speciesId,
    side: 'ally',
    slot,
    attribute: owned.attribute,
    family: sp.family,
    rank: sp.rank,
    scoutStar: sp.scout,
    scoutable: false, // 味方はスカウト対象外
    base,
    hp: base.hp,
    maxHp: base.hp,
    reel: owned.reel.map((p) => ({ ...p })), // 育った個体のリールを持ち込む
    statuses: [],
    alive: true,
  }
}

export function makeUnit(init: UnitInit): BattleUnit {
  const sp = getSpeciesById(init.speciesId)
  if (!sp) throw new Error(`unknown species: ${init.speciesId}`)
  const base = scaledStats(init.speciesId, init.level)
  return {
    uid: `${init.side}-${init.slot}`,
    name: sp.name,
    speciesId: sp.id,
    side: init.side,
    slot: init.slot,
    attribute: sp.attribute as Attribute,
    family: sp.family,
    rank: sp.rank,
    scoutStar: sp.scout,
    // ボス・配合専用(scout=0)はスカウト不可。味方はスカウト対象外。
    scoutable: init.side === 'enemy' && !init.boss && sp.scout > 0 && !sp.fusionOnly,
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
