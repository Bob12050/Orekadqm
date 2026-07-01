// JSON defs を読み込み、ID索引した GameData を組み立てる単一の入口。
// データはここでしか import しない（他モジュールは GameData 経由で参照する）。

import itemsJson from './defs/items.json'
import equipmentJson from './defs/equipment.json'
import jobsJson from './defs/jobs.json'
import skillsJson from './defs/skills.json'
import enemiesJson from './defs/enemies.json'
import dropTablesJson from './defs/dropTables.json'
import mapsJson from './defs/maps.json'
import recipesJson from './defs/recipes.json'
import questsJson from './defs/quests.json'

import type {
  DropTableDef,
  EnemyDef,
  EquipmentDef,
  GameData,
  ItemDef,
  JobDef,
  MapDef,
  QuestDef,
  RecipeDef,
  SkillDef,
} from './types.ts'

function index<T extends { id: string }>(arr: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {}
  for (const def of arr) {
    if (out[def.id]) throw new Error(`重複ID: ${def.id}`)
    out[def.id] = def
  }
  return out
}

let cached: GameData | null = null

/** 全 def を索引した GameData を返す（初回のみ構築）。 */
export function loadGameData(): GameData {
  if (cached) return cached
  cached = {
    items: index(itemsJson as unknown as ItemDef[]),
    equipment: index(equipmentJson as unknown as EquipmentDef[]),
    jobs: index(jobsJson as unknown as JobDef[]),
    skills: index(skillsJson as unknown as SkillDef[]),
    enemies: index(enemiesJson as unknown as EnemyDef[]),
    dropTables: index(dropTablesJson as unknown as DropTableDef[]),
    maps: index(mapsJson as unknown as MapDef[]),
    recipes: index(recipesJson as unknown as RecipeDef[]),
    quests: index(questsJson as unknown as QuestDef[]),
  }
  return cached
}

/** アイテムか装備のどちらかとして解決できるIDか。 */
export function isKnownLootId(data: GameData, id: string): boolean {
  return Boolean(data.items[id] || data.equipment[id])
}

/** ルートIDの表示名。 */
export function lootName(data: GameData, id: string): string {
  return data.items[id]?.name ?? data.equipment[id]?.name ?? id
}
