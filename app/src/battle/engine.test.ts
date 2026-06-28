import { describe, expect, it } from 'vitest'
import { Battle } from './engine'
import type { UnitInit } from './types'

function ally(speciesId: number, slot: number, level = 10): UnitInit {
  return { speciesId, slot, level, side: 'ally' }
}
function enemy(speciesId: number, slot: number, level = 10): UnitInit {
  return { speciesId, slot, level, side: 'enemy' }
}

/** おまかせで決着までドライブ（テスト用） */
function runToEnd(b: Battle, maxTurns = 4000): number {
  let turns = 0
  while (b.outcome === 'ongoing' && turns < maxTurns) {
    if (b.isAllyTurn()) b.takeAllyTurn(b.autoPanelIndex(), null)
    else b.takeEnemyTurn()
    turns++
  }
  return turns
}

describe('Battle — invariants', () => {
  it('always terminates with a winner and consistent alive counts', () => {
    for (let s = 0; s < 12; s++) {
      const b = new Battle(
        [ally(1, 0), ally(7, 1), ally(13, 2), ally(16, 3)],
        [enemy(2, 0), enemy(19, 1), enemy(10, 2)],
        'seed-' + s,
      )
      const turns = runToEnd(b)
      expect(b.outcome).not.toBe('ongoing')
      expect(turns).toBeLessThan(4000)
      if (b.outcome === 'win') {
        expect(b.aliveOf('enemy').length).toBe(0)
        expect(b.aliveOf('ally').length).toBeGreaterThan(0)
      } else {
        expect(b.aliveOf('ally').length).toBe(0)
        expect(b.aliveOf('enemy').length).toBeGreaterThan(0)
      }
    }
  })

  it('hp never goes below 0 or above maxHp during a battle', () => {
    const b = new Battle([ally(6, 0, 20), ally(12, 1, 20)], [enemy(4, 0, 12), enemy(8, 1, 12)], 'hp-check')
    let guard = 0
    while (b.outcome === 'ongoing' && guard++ < 4000) {
      if (b.isAllyTurn()) b.takeAllyTurn(b.autoPanelIndex(), null)
      else b.takeEnemyTurn()
      for (const u of b.units) {
        expect(u.hp).toBeGreaterThanOrEqual(0)
        expect(u.hp).toBeLessThanOrEqual(u.maxHp)
        if (u.hp === 0) expect(u.alive).toBe(false)
      }
    }
  })

  it('is deterministic for the same seed', () => {
    const setup = () =>
      new Battle([ally(3, 0), ally(11, 1)], [enemy(1, 0), enemy(13, 1)], 'determinism')
    const a = setup()
    const b = setup()
    runToEnd(a)
    runToEnd(b)
    expect(a.outcome).toBe(b.outcome)
    expect(a.round).toBe(b.round)
    expect(a.units.map((u) => u.hp)).toEqual(b.units.map((u) => u.hp))
  })

  it('a strong, high-level party reliably beats weak enemies', () => {
    const b = new Battle(
      [ally(6, 0, 25), ally(15, 1, 25), ally(24, 2, 25), ally(27, 3, 25)],
      [enemy(1, 0, 1), enemy(1, 1, 1)],
      'stomp',
    )
    runToEnd(b)
    expect(b.outcome).toBe('win')
  })
})

describe('Battle — targeting', () => {
  it('single-target attack never damages a non-locked opponent', () => {
    // 味方1体 vs 敵2体。狙った敵だけを単体攻撃する。
    const b = new Battle([ally(3, 0, 8)], [enemy(13, 0, 5), enemy(13, 1, 5)], 'lock')
    // 敵の手番を消化して味方の手番にする
    while (b.current && b.current.side === 'enemy') b.takeEnemyTurn()
    const other = b.get('enemy-0')!
    // ニャグモ reel[0] = かぜのつめ（単体攻撃）。enemy-1 をロック。
    b.takeAllyTurn(0, 'enemy-1')
    // 非ターゲットの enemy-0 は無傷のまま
    expect(other.hp).toBe(other.maxHp)
  })
})

describe('Battle — healing', () => {
  it('a heal skill restores a wounded ally', () => {
    const b = new Battle([ally(7, 0, 10)], [enemy(13, 0, 3)], 'heal')
    const healer = b.get('ally-0')!
    healer.hp = 10 // 瀕死に設定
    while (b.current && b.current.side === 'enemy') b.takeEnemyTurn()
    const before = healer.hp
    // ポフィム reel[0] = ヒール
    b.takeAllyTurn(0, null)
    expect(healer.hp).toBeGreaterThan(before)
  })
})
