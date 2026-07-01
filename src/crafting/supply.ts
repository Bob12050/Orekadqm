// 素材の入手可能性を解析する。validate-data と supply.test の両方で使う共通ロジック。

import type { GameData } from '../data/types.ts'
import { possibleOutputs } from '../combat/drops.ts'

/** ドロップ or 他レシピ産出で「いつか」入手しうる全アイテム/装備ID。 */
export function obtainableIds(data: GameData): Set<string> {
  const ids = new Set<string>()
  for (const table of Object.values(data.dropTables)) {
    for (const id of possibleOutputs(table)) ids.add(id)
  }
  for (const recipe of Object.values(data.recipes)) {
    ids.add(recipe.output)
  }
  return ids
}

export interface SupplyGap {
  recipeId: string
  missing: string
}

/** 全レシピ素材（＋強化元）が入手可能かを検査し、欠落を返す。 */
export function findSupplyGaps(data: GameData): SupplyGap[] {
  const obtainable = obtainableIds(data)
  const gaps: SupplyGap[] = []
  for (const recipe of Object.values(data.recipes)) {
    for (const m of recipe.materials) {
      if (!obtainable.has(m.itemId)) gaps.push({ recipeId: recipe.id, missing: m.itemId })
    }
    if (recipe.upgradeFrom && !obtainable.has(recipe.upgradeFrom)) {
      gaps.push({ recipeId: recipe.id, missing: recipe.upgradeFrom })
    }
  }
  return gaps
}
