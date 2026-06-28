import { describe, expect, it } from 'vitest'
import { getChapters, allStagesInOrder, getStage } from './stages'
import { makeUnit } from '../battle/setup'

describe('stage generation', () => {
  it('builds 10 chapters', () => {
    expect(getChapters()).toHaveLength(10)
  })

  it('each chapter has 3 normal stages + 1 boss, with the boss last', () => {
    for (const c of getChapters()) {
      expect(c.stages).toHaveLength(4)
      expect(c.stages[3].boss).toBe(true)
      expect(c.stages.slice(0, 3).every((s) => !s.boss)).toBe(true)
    }
  })

  it('every stage id is unique', () => {
    const ids = allStagesInOrder().map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('enemy counts are within 1..4', () => {
    for (const s of allStagesInOrder()) {
      expect(s.enemies.length).toBeGreaterThanOrEqual(1)
      expect(s.enemies.length).toBeLessThanOrEqual(4)
    }
  })

  it('recommended level is non-decreasing across chapters', () => {
    const ch = getChapters()
    for (let i = 1; i < ch.length; i++) {
      expect(ch[i].recommendedLv[0]).toBeGreaterThanOrEqual(ch[i - 1].recommendedLv[0])
    }
  })

  it('is deterministic (same enemies each build)', () => {
    const a = getStage('c1-1')!.enemies.map((e) => e.speciesId)
    const b = getStage('c1-1')!.enemies.map((e) => e.speciesId)
    expect(a).toEqual(b)
  })

  it('boss enemies are flagged unscoutable and have an HP multiplier', () => {
    const boss = getStage('c1-boss')!
    const lead = boss.enemies[0]
    expect(lead.boss).toBe(true)
    expect(lead.hpMultiplier).toBeGreaterThan(1)
    expect(lead.name).toBe(boss.bossName)
    // makeUnit が反映: スカウト不可・HP倍率
    const unit = makeUnit(lead)
    expect(unit.scoutable).toBe(false)
    expect(unit.name).toBe(boss.bossName)
  })

  it('a later chapter has tougher (higher-level) stages than chapter 1', () => {
    const c1 = getStage('c1-1')!.recommendedLv
    const c5 = getStage('c5-1')!.recommendedLv
    expect(c5).toBeGreaterThan(c1)
  })
})
