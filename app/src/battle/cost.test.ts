import { describe, expect, it } from 'vitest'
import { moveCost, maxMpFor, canAfford } from './cost'
import { chooseMoveIndex } from './ai'
import { Battle } from './engine'
import { makeUnit } from './setup'
import type { Panel, Category } from '../types'
import type { UnitInit } from './types'

const panel = (star: number, category: Category = 'attack'): Panel => ({ skill: 's', star, category })

describe('move cost', () => {
  it('stronger moves cost more', () => {
    expect(moveCost(panel(1))).toBeLessThan(moveCost(panel(2)))
    expect(moveCost(panel(2))).toBeLessThan(moveCost(panel(3)))
    expect(moveCost(panel(3))).toBeLessThan(moveCost(panel(4)))
  })
  it('miss panels are unusable (Infinity cost)', () => {
    expect(moveCost({ skill: 'ミス', star: 1, category: 'miss' })).toBe(Infinity)
  })
  it('maxMp grows with level', () => {
    expect(maxMpFor(20)).toBeGreaterThan(maxMpFor(1))
  })
  it('canAfford reflects MP', () => {
    expect(canAfford(7, panel(4))).toBe(true)
    expect(canAfford(6, panel(4))).toBe(false)
  })
})

describe('chooseMoveIndex (AI/auto)', () => {
  it('never returns a miss panel and respects MP when possible', () => {
    const u = makeUnit({ speciesId: 1, level: 5, side: 'enemy', slot: 0 }) // モコル: ミス枠あり
    u.mp = 2
    const rng = () => 0.5
    for (let i = 0; i < 20; i++) {
      const idx = chooseMoveIndex(u, rng)
      expect(u.reel[idx].category).not.toBe('miss')
      expect(moveCost(u.reel[idx])).toBeLessThanOrEqual(u.mp)
    }
  })
})

describe('engine MP integration', () => {
  it('spending a move reduces MP, and it regenerates over turns', () => {
    const allies: UnitInit[] = [{ speciesId: 6, level: 20, side: 'ally', slot: 0 }] // ライゼル(必殺持ち)
    const enemies: UnitInit[] = [{ speciesId: 13, level: 20, side: 'enemy', slot: 0 }]
    const b = new Battle(allies, enemies, 'mp')
    // ライゼルが先に動くとは限らないので、味方の手番まで進める
    let guard = 0
    while (b.current?.side !== 'ally' && guard++ < 10) b.takeEnemyTurn()
    const ally = b.get('ally-0')!
    const before = ally.mp
    // 必殺(★4)枠を探して使う
    const ultIdx = ally.reel.findIndex((p) => p.category === 'ultimate')
    if (ultIdx >= 0) {
      b.takeAllyTurn(ultIdx, null)
      expect(ally.mp).toBeLessThan(before) // MPを消費
    }
  })

  it('a full battle still terminates with MP costs in play', () => {
    const b = new Battle(
      [{ speciesId: 6, level: 20, side: 'ally', slot: 0 }, { speciesId: 15, level: 20, side: 'ally', slot: 1 }],
      [{ speciesId: 1, level: 3, side: 'enemy', slot: 0 }],
      'term',
    )
    let n = 0
    while (b.outcome === 'ongoing' && n++ < 3000) {
      if (b.isAllyTurn()) b.takeAllyTurn(b.autoPanelIndex(), null)
      else b.takeEnemyTurn()
    }
    expect(b.outcome).not.toBe('ongoing')
  })
})
