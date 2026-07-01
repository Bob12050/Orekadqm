import { describe, expect, it } from 'vitest'
import { loadGameData } from '../src/data/loader.ts'
import { newSave } from '../src/save/schema.ts'
import { consumeItem, grantLoot, hasItem } from '../src/save/inventory.ts'
import { clearSave, loadSave, writeSave } from '../src/save/db.ts'

const data = loadGameData()

describe('セーブスキーマ', () => {
  it('新規セーブは instances 配列を初日から持つ（エンドゲーム用の確保）', () => {
    const s = newSave('job_warrior')
    expect(Array.isArray(s.instances)).toBe(true)
    expect(s.instances.length).toBe(0)
    expect(s.version).toBe(1)
  })
})

describe('インベントリ', () => {
  it('装備は ownedEquipment、素材は inventory に入る', () => {
    const s = newSave('job_warrior')
    grantLoot(s, data, 'mat_iron_shard', 3)
    grantLoot(s, data, 'mat_iron_shard', 2)
    grantLoot(s, data, 'eq_round_shield', 1)
    expect(hasItem(s, 'mat_iron_shard', 5)).toBe(true)
    expect(s.ownedEquipment).toContain('eq_round_shield')
  })

  it('消費は不足時に失敗し在庫を変えない', () => {
    const s = newSave('job_warrior')
    grantLoot(s, data, 'item_potion_s', 1)
    expect(consumeItem(s, 'item_potion_s', 2)).toBe(false)
    expect(hasItem(s, 'item_potion_s', 1)).toBe(true)
    expect(consumeItem(s, 'item_potion_s', 1)).toBe(true)
    expect(hasItem(s, 'item_potion_s', 1)).toBe(false)
  })
})

describe('IndexedDB ラウンドトリップ', () => {
  it('書き込み→読み込みで一致する', async () => {
    await clearSave()
    const s = newSave('job_mage')
    grantLoot(s, data, 'mat_slime_gel', 4)
    await writeSave(s)
    const loaded = await loadSave()
    expect(loaded).not.toBeNull()
    expect(loaded!.player.jobId).toBe('job_mage')
    expect(loaded!.inventory.find((e) => e.itemId === 'mat_slime_gel')?.count).toBe(4)
    expect(loaded!.savedAt).toBeGreaterThan(0)
  })
})
