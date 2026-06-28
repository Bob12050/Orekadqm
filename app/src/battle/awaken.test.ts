import { describe, expect, it } from 'vitest'
import { makeUnitFromOwned } from './setup'
import { createOwned } from '../state/collection'

describe('awakening — battle stats', () => {
  it('an awakened unit has higher HP/ATK than a non-awakened one of the same level', () => {
    const base = createOwned(1, 15)
    const awk = { ...base, awakened: true }
    const u1 = makeUnitFromOwned(base, 0)
    const u2 = makeUnitFromOwned(awk, 0)
    expect(u2.maxHp).toBeGreaterThan(u1.maxHp)
    expect(u2.base.atk).toBeGreaterThan(u1.base.atk)
    expect(u2.awakened).toBe(true)
  })

  it('accuracy and luck are unchanged by awakening', () => {
    const base = createOwned(1, 15)
    const u1 = makeUnitFromOwned(base, 0)
    const u2 = makeUnitFromOwned({ ...base, awakened: true }, 0)
    expect(u2.base.acc).toBe(u1.base.acc)
    expect(u2.base.luck).toBe(u1.base.luck)
  })
})
