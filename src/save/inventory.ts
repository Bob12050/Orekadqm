// インベントリ操作は純関数（Vitest でヘッドレス検証）。SaveData を直接変異せず新配列を返す。

import type { GameData } from '../data/types.ts'
import type { InventoryEntry, SaveData } from './schema.ts'

/** アイテムを加える。装備はスタックせず ownedEquipment へ、それ以外は inventory へ。 */
export function grantLoot(save: SaveData, data: GameData, itemId: string, count: number): void {
  if (data.equipment[itemId]) {
    for (let i = 0; i < count; i++) save.ownedEquipment.push(itemId)
    return
  }
  const def = data.items[itemId]
  const stack = def?.stack ?? 99
  const entry = save.inventory.find((e) => e.itemId === itemId)
  if (entry) {
    entry.count = Math.min(stack * 99, entry.count + count)
  } else {
    save.inventory.push({ itemId, count: Math.min(stack * 99, count) })
  }
}

/** 指定数を所持しているか。 */
export function hasItem(save: SaveData, itemId: string, count: number): boolean {
  const entry = save.inventory.find((e) => e.itemId === itemId)
  return (entry?.count ?? 0) >= count
}

/** 消費。足りなければ false（変更なし）。 */
export function consumeItem(save: SaveData, itemId: string, count: number): boolean {
  const entry = save.inventory.find((e) => e.itemId === itemId)
  if (!entry || entry.count < count) return false
  entry.count -= count
  if (entry.count <= 0) {
    save.inventory = save.inventory.filter((e) => e !== entry)
  }
  return true
}

export function inventorySorted(save: SaveData): InventoryEntry[] {
  return [...save.inventory].sort((a, b) => a.itemId.localeCompare(b.itemId))
}
