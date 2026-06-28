import { describe, expect, it } from 'vitest'
import { createRng, pick, randInt } from './seededRng'

describe('seededRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng('seed-x')
    const b = createRng('seed-x')
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, createRng('a'))
    const b = Array.from({ length: 20 }, createRng('b'))
    expect(a).not.toEqual(b)
  })

  it('outputs are within [0, 1)', () => {
    const r = createRng(42)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('randInt and pick stay in range', () => {
    const r = createRng('range')
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 200; i++) {
      expect(randInt(r, 3)).toBeLessThan(3)
      expect(arr).toContain(pick(r, arr))
    }
  })
})
