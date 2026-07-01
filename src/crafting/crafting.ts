// クラフト（直接生産＋強化）。純TS。

import type { GameData, RecipeDef } from '../data/types.ts'
import type { SaveData } from '../save/schema.ts'
import { consumeItem, hasItem } from '../save/inventory.ts'

export interface CraftCheck {
  ok: boolean
  reason?: string
}

/** レシピを実行できるか（素材＋強化元の所持）。 */
export function canCraft(save: SaveData, recipe: RecipeDef): CraftCheck {
  for (const m of recipe.materials) {
    if (!hasItem(save, m.itemId, m.count)) {
      return { ok: false, reason: `素材が不足: ${m.itemId}` }
    }
  }
  if (recipe.upgradeFrom && !save.ownedEquipment.includes(recipe.upgradeFrom)) {
    return { ok: false, reason: `強化元が必要: ${recipe.upgradeFrom}` }
  }
  return { ok: true }
}

/** レシピを実行し、素材消費と成果物付与を行う。成功で true。 */
export function craft(save: SaveData, data: GameData, recipe: RecipeDef): boolean {
  const check = canCraft(save, recipe)
  if (!check.ok) return false
  for (const m of recipe.materials) consumeItem(save, m.itemId, m.count)
  if (recipe.upgradeFrom) {
    const idx = save.ownedEquipment.indexOf(recipe.upgradeFrom)
    if (idx >= 0) save.ownedEquipment.splice(idx, 1)
  }
  if (data.equipment[recipe.output]) {
    save.ownedEquipment.push(recipe.output)
  }
  return true
}
