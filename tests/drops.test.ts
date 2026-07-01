import { describe, expect, it } from 'vitest'
import { loadGameData } from '../src/data/loader.ts'
import { possibleOutputs, rollDrops } from '../src/combat/drops.ts'
import { Rng } from '../src/combat/rng.ts'

const data = loadGameData()

describe('rollDrops', () => {
  it('同じシードなら決定的', () => {
    const table = data.dropTables['dt_wolf']!
    const a = rollDrops(table, new Rng(1234))
    const b = rollDrops(table, new Rng(1234))
    expect(a).toEqual(b)
  })

  it('ボス初回討伐で確定ドロップが出る', () => {
    const table = data.dropTables['dt_boss']!
    const first = rollDrops(table, new Rng(7), { firstKill: true, rolls: 3 })
    expect(first.some((d) => d.itemId === 'eq_ember_blade' && d.special)).toBe(true)
    const repeat = rollDrops(table, new Rng(7), { firstKill: false, rolls: 3 })
    expect(repeat.some((d) => d.itemId === 'eq_ember_blade')).toBe(false)
  })

  it('抽選結果は必ずテーブルの出力集合に含まれる', () => {
    const table = data.dropTables['dt_slime']!
    const outputs = new Set(possibleOutputs(table))
    for (let seed = 0; seed < 50; seed++) {
      for (const d of rollDrops(table, new Rng(seed))) {
        expect(outputs.has(d.itemId)).toBe(true)
        expect(d.count).toBeGreaterThanOrEqual(1)
      }
    }
  })
})
