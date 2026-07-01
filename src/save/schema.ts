// セーブスキーマ。ItemInstance（ランダム性能の装備個体）を初日から確保する
// （後付けが最大の改修になるという前作の反省）。

import type { BaseStats, EquipSlot } from '../data/types.ts'
import { EQUIP_SLOTS } from '../data/types.ts'

export const SAVE_VERSION = 1

/** ランダム性能の装備個体（エンドゲームのハクスラ用。Phase 0 では空配列で保持）。 */
export interface ItemInstance {
  instanceId: string
  /** 元となる装備 def のID。 */
  baseId: string
  /** ランダム付与された追加ステータス。 */
  affixes: { stat: keyof BaseStats; value: number }[]
  rarity: number
}

export interface InventoryEntry {
  itemId: string
  count: number
}

export interface QuestProgress {
  questId: string
  progress: number
  done: boolean
  accepted: boolean
}

export interface PlayerState {
  jobId: string
  level: number
  exp: number
  hp: number
  mp: number
  /** プレイヤー固有の一次ステ振り分け（職業補正とは別）。 */
  base: BaseStats
  learnedSkills: string[]
}

export type EquippedMap = Record<EquipSlot, string | null>

export interface SaveData {
  version: number
  player: PlayerState
  /** 装備中スロット（装備 def のID、または instanceId）。 */
  equipped: EquippedMap
  /** 所持している通常装備（def ID の多重集合）。 */
  ownedEquipment: string[]
  inventory: InventoryEntry[]
  /** ランダム個体。Phase 0 では未使用だがスキーマに確保。 */
  instances: ItemInstance[]
  quests: QuestProgress[]
  /** 討伐済みボスID（確定ドロップの初回判定用）。 */
  killedBosses: string[]
  settings: { sfx: boolean }
  savedAt: number
}

function emptyEquip(): EquippedMap {
  const map = {} as EquippedMap
  for (const s of EQUIP_SLOTS) map[s] = null
  return map
}

/** 新規プレイヤーの初期セーブ。 */
export function newSave(jobId: string): SaveData {
  return {
    version: SAVE_VERSION,
    player: {
      jobId,
      level: 1,
      exp: 0,
      hp: -1, // -1 は「最大値で開始」の意味。ロード時に解決する
      mp: -1,
      base: { str: 0, vit: 0, int: 0, dex: 0, luk: 0 },
      learnedSkills: [],
    },
    equipped: emptyEquip(),
    ownedEquipment: [],
    inventory: [],
    instances: [],
    quests: [],
    killedBosses: [],
    settings: { sfx: true },
    savedAt: 0,
  }
}

/** 旧バージョンのセーブを最新スキーマへ移行する（将来の互換用の骨組み）。 */
export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<SaveData>
  if (typeof data.version !== 'number') return null
  // 現状 v1 のみ。将来 version < SAVE_VERSION の変換をここに足す。
  if (!data.player || !data.equipped) return null
  return data as SaveData
}
