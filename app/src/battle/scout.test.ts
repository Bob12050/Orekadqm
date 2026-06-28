import { describe, expect, it } from 'vitest'
import { baseFromStar, scoutFactors, scoutStars, GAUGE_MAX } from './scout'
import { Battle } from './engine'
import { makeUnit } from './setup'
import type { BattleUnit, StatusInstance, UnitInit } from './types'

function enemyUnit(over: Partial<BattleUnit> = {}): BattleUnit {
  const u = makeUnit({ speciesId: 1, level: 5, side: 'enemy', slot: 0 }) // モコル(scout★1)
  return { ...u, ...over }
}

describe('scout — chance formula', () => {
  it('easier star gives higher base than harder star', () => {
    expect(baseFromStar(1)).toBeGreaterThan(baseFromStar(5))
  })

  it('lower HP increases success chance', () => {
    const full = enemyUnit({ hp: 100, maxHp: 100 })
    const low = enemyUnit({ hp: 10, maxHp: 100 })
    expect(scoutFactors(low, 0).chance).toBeGreaterThan(scoutFactors(full, 0).chance)
  })

  it('sleep/paralyze raises chance more than no status', () => {
    // クランプ上限を避けるため、手強い★4の対象で比較
    const plain = enemyUnit({ hp: 70, maxHp: 100, scoutStar: 4 })
    const asleep = enemyUnit({ hp: 70, maxHp: 100, scoutStar: 4, statuses: [{ kind: 'sleep', remaining: 3, magnitude: 1 }] as StatusInstance[] })
    expect(scoutFactors(asleep, 0).chance).toBeGreaterThan(scoutFactors(plain, 0).chance)
  })

  it('bond points add to the chance (failure is not wasted)', () => {
    const t = enemyUnit({ hp: 60, maxHp: 100 })
    expect(scoutFactors(t, 5).chance).toBeGreaterThan(scoutFactors(t, 0).chance)
  })

  it('chance is clamped within [0.05, 0.95]', () => {
    const dying = enemyUnit({ hp: 1, maxHp: 100, scoutStar: 1, statuses: [{ kind: 'sleep', remaining: 3, magnitude: 1 }] as StatusInstance[] })
    expect(scoutFactors(dying, 30).chance).toBeLessThanOrEqual(0.95)
    const tough = enemyUnit({ hp: 100, maxHp: 100, scoutStar: 5, rank: 'A' })
    expect(scoutFactors(tough, 0).chance).toBeGreaterThanOrEqual(0.05)
  })

  it('non-scoutable target returns 0', () => {
    const boss = enemyUnit({ scoutable: false })
    expect(scoutFactors(boss, 0).chance).toBe(0)
  })

  it('scoutStars maps chance to 1..5', () => {
    expect(scoutStars(0.05)).toBe(1)
    expect(scoutStars(0.95)).toBe(5)
    expect(scoutStars(0.4)).toBe(3)
  })
})

describe('scout — engine integration', () => {
  // 与し易い攻撃役 vs 硬くて倒れにくいスカウト★1の敵（撃破前にゲージが貯まる構図）
  const allies: UnitInit[] = [{ speciesId: 3, level: 6, side: 'ally', slot: 0 }] // ニャグモ
  const enemies: UnitInit[] = [{ speciesId: 13, level: 8, side: 'enemy', slot: 0 }] // コロリン(タンク, scout★1)

  function driveUntilGaugeReady(b: Battle, maxTurns = 200): void {
    let n = 0
    while (b.outcome === 'ongoing' && !b.gaugeReady && n++ < maxTurns) {
      if (b.isAllyTurn()) b.takeAllyTurn(b.autoPanelIndex(), null)
      else b.takeEnemyTurn()
    }
  }

  it('gauge fills from combat and enables scouting', () => {
    const b = new Battle(allies, enemies, 'gauge')
    expect(b.scoutGauge).toBe(0)
    expect(b.gaugeReady).toBe(false)
    driveUntilGaugeReady(b)
    // ゲージが満タンになり、敵が生存していればスカウト可能
    if (b.outcome === 'ongoing') {
      expect(b.scoutGauge).toBe(GAUGE_MAX)
      const enemyAlive = b.aliveOf('enemy')[0]
      if (enemyAlive) expect(b.canScout(enemyAlive.uid)).toBe(true)
    }
  })

  it('a high enough chance scout succeeds and recruits (removing the enemy)', () => {
    // 成功率を上げるため敵を弱らせ、確実に成功するシードを探す
    let recruited = false
    for (let s = 0; s < 30 && !recruited; s++) {
      const b = new Battle(allies, enemies, 'recruit-' + s)
      let n = 0
      while (b.outcome === 'ongoing' && n++ < 400) {
        if (!b.isAllyTurn()) {
          b.takeEnemyTurn()
          continue
        }
        const foe = b.aliveOf('enemy')[0]
        if (foe && b.canScout(foe.uid) && b.scoutChanceFor(foe.uid) > 0.3) {
          const before = b.recruited.length
          b.takeAllyScout(foe.uid)
          if (b.recruited.length > before) {
            recruited = true
            expect(b.units.find((u) => u.uid === foe.uid)).toBeUndefined()
            expect(b.outcome).toBe('win') // 最後の敵を仲間化→勝利
            break
          }
        } else {
          b.takeAllyTurn(b.autoPanelIndex(), null)
        }
      }
    }
    expect(recruited).toBe(true)
  })

  it('a failed scout adds a bond point and does not recruit', () => {
    const b = new Battle(allies, enemies, 'fail-seed')
    // ゲージを満タンに
    let n = 0
    while (b.outcome === 'ongoing' && !b.gaugeReady && n++ < 200) {
      if (b.isAllyTurn()) b.takeAllyTurn(b.autoPanelIndex(), null)
      else b.takeEnemyTurn()
    }
    if (b.outcome !== 'ongoing') return
    const foe = b.aliveOf('enemy')[0]
    // 成功率が0%でない限り、失敗時に絆が増えることだけを検証（複数シードで失敗を引く）
    let sawFail = false
    for (let s = 0; s < 40 && !sawFail; s++) {
      const b2 = new Battle(allies, enemies, 'failcheck-' + s)
      let m = 0
      while (b2.outcome === 'ongoing' && !b2.gaugeReady && m++ < 200) {
        if (b2.isAllyTurn()) b2.takeAllyTurn(b2.autoPanelIndex(), null)
        else b2.takeEnemyTurn()
      }
      if (b2.outcome !== 'ongoing') continue
      const f2 = b2.aliveOf('enemy')[0]
      if (!f2 || !b2.canScout(f2.uid)) continue
      const beforeBond = b2.bonds[f2.uid] ?? 0
      const beforeRecruit = b2.recruited.length
      b2.takeAllyScout(f2.uid)
      if (b2.recruited.length === beforeRecruit && b2.units.find((u) => u.uid === f2.uid)) {
        // 失敗した
        expect((b2.bonds[f2.uid] ?? 0)).toBe(beforeBond + 1)
        sawFail = true
      }
    }
    expect(foe).toBeDefined()
    expect(sawFail).toBe(true)
  })
})
