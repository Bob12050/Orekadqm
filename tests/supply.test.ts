import { describe, expect, it } from 'vitest'
import { loadGameData } from '../src/data/loader.ts'
import { findSupplyGaps, obtainableIds } from '../src/crafting/supply.ts'

const data = loadGameData()

describe('素材の入手可能性', () => {
  it('全レシピの素材はドロップか他レシピで入手できる', () => {
    const gaps = findSupplyGaps(data)
    expect(gaps).toEqual([])
  })

  it('入手可能集合には主要素材が含まれる', () => {
    const ids = obtainableIds(data)
    expect(ids.has('mat_wolf_fang')).toBe(true)
    expect(ids.has('mat_ember_core')).toBe(true)
  })
})
