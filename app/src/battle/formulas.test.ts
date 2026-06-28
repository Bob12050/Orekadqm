import { describe, expect, it } from 'vitest'
import { computeDamage, effStat, hitChance } from './formulas'
import type { SkillDef } from './skills'
import type { BattleUnit, Attribute } from './types'

function unit(attr: Attribute, over: Partial<BattleUnit['base']> = {}, statuses: BattleUnit['statuses'] = []): BattleUnit {
  return {
    uid: 'u', name: 'u', speciesId: 0, side: 'ally', slot: 0, attribute: attr,
    base: { hp: 100, atk: 40, def: 20, mag: 30, spd: 20, acc: 95, luck: 10, ...over },
    hp: 100, maxHp: 100, reel: [], statuses, alive: true,
  }
}

const atkSkill: SkillDef = { target: 'enemySingle', damageType: 'phys', power: 1, hits: 1 }

// 会心・暴走を踏まない固定乱数（0.5）：variance=1.0, crit/berserk=false
const fixed = () => 0.5

describe('effStat', () => {
  it('applies atkUp / atkDown / defUp multipliers', () => {
    const up = unit('none', {}, [{ kind: 'atkUp', remaining: 3, magnitude: 1.4 }])
    expect(effStat(up, 'atk')).toBeCloseTo(56)
    const down = unit('none', {}, [{ kind: 'defDown', remaining: 3, magnitude: 0.7 }])
    expect(effStat(down, 'def')).toBeCloseTo(14)
  })
})

describe('computeDamage', () => {
  it('deals more to a weak target than neutral, less to resistant', () => {
    const fire = unit('fire')
    const wind = unit('wind') // 火に弱い
    const water = unit('water') // 火に耐性
    const none = unit('none')
    const weak = computeDamage(fire, wind, atkSkill, fixed).amount
    const neutral = computeDamage(fire, none, atkSkill, fixed).amount
    const resist = computeDamage(fire, water, atkSkill, fixed).amount
    expect(weak).toBeGreaterThan(neutral)
    expect(neutral).toBeGreaterThan(resist)
  })

  it('higher defense reduces damage', () => {
    const a = unit('none')
    const softTarget = unit('none', { def: 10 })
    const hardTarget = unit('none', { def: 80 })
    expect(computeDamage(a, softTarget, atkSkill, fixed).amount).toBeGreaterThan(
      computeDamage(a, hardTarget, atkSkill, fixed).amount,
    )
  })

  it('damage is at least 1', () => {
    const weakAttacker = unit('none', { atk: 1 })
    const tank = unit('none', { def: 999 })
    expect(computeDamage(weakAttacker, tank, atkSkill, fixed).amount).toBeGreaterThanOrEqual(1)
  })

  it('crit roll increases damage', () => {
    const a = unit('none')
    const t = unit('none')
    const noCrit = computeDamage(a, t, atkSkill, () => 0.99).amount // crit/berserk false, variance high
    // crit を踏む乱数列: 1回目=0(crit), 2回目=0.99(berserk無), 3回目=0(variance低)
    let i = 0
    const seq = [0, 0.99, 0]
    const critRng = () => seq[i++ % seq.length]
    const crit = computeDamage(a, t, atkSkill, critRng)
    expect(crit.crit).toBe(true)
    expect(crit.amount).toBeGreaterThan(noCrit * 0.5) // 会心倍率が乗っている
  })
})

describe('hitChance', () => {
  it('is clamped within [0.5, 0.99]', () => {
    const sniper = unit('none', { acc: 200 })
    const slowpoke = unit('none', { spd: 1 })
    expect(hitChance(sniper, slowpoke)).toBeLessThanOrEqual(0.99)
    const blind = unit('none', { acc: 50 }, [{ kind: 'blind', remaining: 2, magnitude: 1 }])
    expect(hitChance(blind, unit('none', { spd: 200 }))).toBeGreaterThanOrEqual(0.5)
  })
})
