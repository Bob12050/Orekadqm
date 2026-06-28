import { describe, expect, it } from 'vitest'
import { autoStopIndex, reelPower, resolveStop } from './reelEngine'
import { createRng } from './seededRng'
import type { Panel } from '../types'

const reel: Panel[] = [
  { skill: 'ミス', star: 1, category: 'miss' },
  { skill: 'ひっかき', star: 2, category: 'attack' },
  { skill: 'みだれ爪', star: 3, category: 'attack' },
  { skill: 'きずなの牙', star: 4, category: 'ultimate' },
]

describe('reelEngine', () => {
  it('autoStopIndex stays within bounds', () => {
    const rng = createRng('stops')
    for (let i = 0; i < 500; i++) {
      const idx = autoStopIndex(reel.length, rng)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(reel.length)
    }
  })

  it('autoStopIndex is deterministic per seed', () => {
    const a = Array.from({ length: 10 }, () => autoStopIndex(reel.length, createRng('fixed')))
    // 同じシードを毎回作り直せば同じ最初の値になる
    expect(a.every((v) => v === a[0])).toBe(true)
  })

  it('resolveStop flags miss panels', () => {
    expect(resolveStop(reel, 0).isMiss).toBe(true)
    expect(resolveStop(reel, 1).isMiss).toBe(false)
  })

  it('resolveStop wraps out-of-range indices', () => {
    expect(resolveStop(reel, reel.length).panel.skill).toBe('ミス')
    expect(resolveStop(reel, -1).panel.skill).toBe('きずなの牙')
  })

  it('reelPower ignores miss panels and averages stars', () => {
    // (0 + 2 + 3 + 4) / 4 = 2.25
    expect(reelPower(reel)).toBeCloseTo(2.25, 2)
    expect(reelPower([])).toBe(0)
  })
})
