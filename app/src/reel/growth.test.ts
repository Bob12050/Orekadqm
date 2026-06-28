import { describe, expect, it } from 'vitest'
import { levelUpMutate, toggleLock } from './growth'
import { createRng } from './seededRng'
import type { Panel, PoolEntry } from '../types'

const pool: PoolEntry[] = [
  { skill: 'ひっかき', star: 2, category: 'attack' },
  { skill: 'からだ当たり', star: 2, category: 'attack' },
  { skill: 'みだれ爪', star: 3, category: 'attack' },
  { skill: 'うなり', star: 1, category: 'debuff' },
  { skill: 'きずなの牙', star: 4, category: 'ultimate' },
]

const baseReel = (): Panel[] => [
  { skill: 'ミス', star: 1, category: 'miss' },
  { skill: 'ひっかき', star: 2, category: 'attack' },
  { skill: 'からだ当たり', star: 2, category: 'attack' },
  { skill: 'うなり', star: 1, category: 'debuff' },
]

describe('levelUpMutate', () => {
  it('exactly one panel changes per level up', () => {
    const reel = baseReel()
    const res = levelUpMutate(reel, pool, createRng('s1'))
    expect(res.mutatedIndex).not.toBeNull()
    let diff = 0
    res.reel.forEach((p, i) => {
      if (p.skill !== reel[i].skill || p.star !== reel[i].star) diff++
    })
    expect(diff).toBe(1)
  })

  it('does not mutate the input array (immutability)', () => {
    const reel = baseReel()
    const snapshot = JSON.stringify(reel)
    levelUpMutate(reel, pool, createRng('s2'))
    expect(JSON.stringify(reel)).toBe(snapshot)
  })

  it('is deterministic for the same seed', () => {
    const a = levelUpMutate(baseReel(), pool, createRng('same'))
    const b = levelUpMutate(baseReel(), pool, createRng('same'))
    expect(a.reel).toEqual(b.reel)
    expect(a.mutatedIndex).toBe(b.mutatedIndex)
  })

  it('never mutates a locked panel', () => {
    const reel = baseReel().map((p, i) => (i === 0 ? { ...p, locked: true } : p))
    // 多数試行しても index 0 は変化しない
    for (let i = 0; i < 200; i++) {
      const res = levelUpMutate(reel, pool, createRng('lock-' + i))
      expect(res.mutatedIndex).not.toBe(0)
      expect(res.reel[0].skill).toBe('ミス')
    }
  })

  it('returns no mutation when all panels are locked', () => {
    const reel = baseReel().map((p) => ({ ...p, locked: true }))
    const res = levelUpMutate(reel, pool, createRng('all-locked'))
    expect(res.mutatedIndex).toBeNull()
    expect(res.after).toBeNull()
  })

  it('marks exactly one panel as NEW and clears others', () => {
    const reel = baseReel().map((p, i) => (i === 1 ? { ...p, isNew: true } : p))
    const res = levelUpMutate(reel, pool, createRng('new'))
    expect(res.reel.filter((p) => p.isNew).length).toBe(1)
  })

  it('can produce a rare jump to a high-star panel', () => {
    // rareJumpChance=1 で必ず ★3 以上に化ける
    let maxStar = 0
    for (let i = 0; i < 30; i++) {
      const res = levelUpMutate(baseReel(), pool, createRng('rare-' + i), { rareJumpChance: 1 })
      if (res.after) maxStar = Math.max(maxStar, res.after.star)
      expect(res.after!.star).toBeGreaterThanOrEqual(3)
    }
    expect(maxStar).toBeGreaterThanOrEqual(3)
  })

  it('over many level ups, average reel star tends to increase (growth)', () => {
    let reel = baseReel()
    const rng = createRng('growth-run')
    const avg = (r: Panel[]) =>
      r.reduce((s, p) => s + (p.category === 'miss' ? 0 : p.star), 0) / r.length
    const start = avg(reel)
    for (let i = 0; i < 40; i++) reel = levelUpMutate(reel, pool, rng).reel
    expect(avg(reel)).toBeGreaterThan(start)
  })
})

describe('toggleLock', () => {
  it('flips only the targeted panel', () => {
    const reel = baseReel()
    const out = toggleLock(reel, 2)
    expect(out[2].locked).toBe(true)
    expect(out[0].locked).toBeFalsy()
    expect(reel[2].locked).toBeFalsy() // 元配列は不変
  })
})
