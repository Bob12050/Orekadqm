import { describe, expect, it } from 'vitest'
import { loadGameData } from '../src/data/loader.ts'
import { aggregateBaseStats, aggregateDerivedMods, computeDerived } from '../src/stats/stats.ts'

const data = loadGameData()

describe('computeDerived', () => {
  const base = { str: 10, vit: 10, int: 10, dex: 10, luk: 10 }

  it('レベルが上がると maxHp/maxMp が増える', () => {
    const lo = computeDerived(base, 1)
    const hi = computeDerived(base, 10)
    expect(hi.maxHp).toBeGreaterThan(lo.maxHp)
    expect(hi.maxMp).toBeGreaterThan(lo.maxMp)
  })

  it('critRate は上限でクランプされる', () => {
    const d = computeDerived({ str: 0, vit: 0, int: 0, dex: 999, luk: 999 }, 1)
    expect(d.critRate).toBeLessThanOrEqual(0.8)
    expect(d.atkSpeed).toBeLessThanOrEqual(3)
  })

  it('装備の derivedMods が加算される', () => {
    const without = computeDerived(base, 1)
    const withMod = computeDerived(base, 1, { def: 10 })
    expect(withMod.def).toBe(without.def + 10)
  })
})

describe('aggregate', () => {
  it('職業＋レベル成長＋装備で base ステが積み上がる', () => {
    const warrior = data.jobs['job_warrior']!
    const sword = data.equipment['eq_wood_sword']!
    const lv1 = aggregateBaseStats({ job: warrior, level: 1, equipment: [] })
    const lv5eq = aggregateBaseStats({ job: warrior, level: 5, equipment: [sword] })
    expect(lv5eq.str).toBeGreaterThan(lv1.str)
    // レベル5成長ぶん + 剣のstr+4
    expect(lv5eq.str).toBe(warrior.statBase.str + warrior.statGrowth.str * 4 + sword.statMods.str!)
  })

  it('derivedMods を持つ装備だけ合算される', () => {
    const shield = data.equipment['eq_round_shield']!
    const mods = aggregateDerivedMods([shield])
    expect(mods.def).toBe(shield.derivedMods!.def)
  })
})
