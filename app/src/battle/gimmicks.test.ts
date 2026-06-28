import { describe, expect, it } from 'vitest'
import { Battle } from './engine'
import { makeUnit } from './setup'
import type { BattleUnit, UnitInit } from './types'

function drive(b: Battle, maxTurns = 3000): void {
  let n = 0
  while (b.outcome === 'ongoing' && n++ < maxTurns) {
    if (b.isAllyTurn()) b.takeAllyTurn(b.autoPanelIndex(), null)
    else b.takeEnemyTurn()
  }
}

const STRONG_ALLY: UnitInit[] = [
  { speciesId: 15, slot: 0, level: 30, side: 'ally' }, // メタルゴ(壁)
  { speciesId: 6, slot: 1, level: 30, side: 'ally' }, // ライゼル(火力)
]

describe('boss gimmicks', () => {
  it('attribute-shift boss changes its attribute over rounds', () => {
    const boss: UnitInit = {
      speciesId: 28, level: 20, side: 'enemy', slot: 0, boss: true, hpMultiplier: 6,
      name: '試験ボス', gimmicks: ['phases', 'attributeShift'],
      shiftCycle: ['fire', 'water', 'wind', 'earth'],
    }
    const allyUnits = STRONG_ALLY.map(makeUnit)
    const bossUnit = makeUnit(boss)
    const b = Battle.fromUnits([...allyUnits, bossUnit], 'shift')
    const seen = new Set<string>()
    let n = 0
    while (b.outcome === 'ongoing' && n++ < 400) {
      const u = b.get(bossUnit.uid)
      if (u) seen.add(u.attribute)
      if (b.isAllyTurn()) b.takeAllyTurn(b.autoPanelIndex(), null)
      else b.takeEnemyTurn()
    }
    expect(seen.size).toBeGreaterThan(1) // 属性が複数回変わった
  })

  it('summoning boss can add minions mid-battle (enemy count exceeds initial)', () => {
    const boss: UnitInit = {
      speciesId: 12, level: 24, side: 'enemy', slot: 0, boss: true, hpMultiplier: 8,
      name: '召喚ボス', gimmicks: ['phases', 'summon'], minionSpeciesId: 1, minionLevel: 8,
    }
    const allyUnits = STRONG_ALLY.map(makeUnit)
    const b = Battle.fromUnits([...allyUnits, makeUnit(boss)], 'summon')
    let maxEnemies = b.aliveOf('enemy').length
    let n = 0
    while (b.outcome === 'ongoing' && n++ < 600) {
      maxEnemies = Math.max(maxEnemies, b.units.filter((u) => u.side === 'enemy').length)
      if (b.isAllyTurn()) b.takeAllyTurn(b.autoPanelIndex(), null)
      else b.takeEnemyTurn()
    }
    // 初期1体 → 召喚で増える
    expect(maxEnemies).toBeGreaterThan(1)
  })

  it('boss advances phases as HP drops (enrage)', () => {
    const boss: BattleUnit = makeUnit({
      speciesId: 15, level: 20, side: 'enemy', slot: 0, boss: true, hpMultiplier: 4,
      name: 'フェーズボス', gimmicks: ['phases'],
    })
    const allyUnits = STRONG_ALLY.map(makeUnit)
    const b = Battle.fromUnits([...allyUnits, boss], 'phase')
    let maxPhase = 1
    let n = 0
    while (b.outcome === 'ongoing' && n++ < 800) {
      const u = b.get(boss.uid)
      if (u?.phase) maxPhase = Math.max(maxPhase, u.phase)
      if (b.isAllyTurn()) b.takeAllyTurn(b.autoPanelIndex(), null)
      else b.takeEnemyTurn()
    }
    expect(maxPhase).toBeGreaterThan(1)
  })

  it('battle with a gimmick boss still terminates', () => {
    const boss = makeUnit({
      speciesId: 12, level: 20, side: 'enemy', slot: 0, boss: true, hpMultiplier: 5,
      name: '総合ボス', gimmicks: ['phases', 'attributeShift', 'summon'],
      shiftCycle: ['fire', 'water', 'wind', 'earth'], minionSpeciesId: 1, minionLevel: 6,
    })
    const b = Battle.fromUnits([...STRONG_ALLY.map(makeUnit), boss], 'all-gimmicks')
    drive(b)
    expect(b.outcome).not.toBe('ongoing')
  })
})
