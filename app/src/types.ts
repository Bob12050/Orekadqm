// 縦式リール・プロトタイプの共通型。data/monsters.json (schema v2) に対応。

export type Category =
  | 'attack'
  | 'magic'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'defense'
  | 'support'
  | 'ultimate'
  | 'miss'

/** リール上の1パネル（戦闘・育成のランタイム表現） */
export interface Panel {
  skill: string
  star: number // 1..4 (miss は 1 扱い)
  category: Category
  locked?: boolean // ロック中は育成のランダム変化対象から除外
  isNew?: boolean // 直近のレベルアップで変化した枠（NEW バッジ表示用）
}

/** 系統別の成長プール1エントリ */
export interface PoolEntry {
  skill: string
  star: number
  category: Category
}

/** マスタの種データ（reel は初期パネル列） */
export interface Species {
  id: number
  name: string
  family: string
  rank: string
  attribute: string
  role: string
  scout: number
  fusionOnly?: boolean
  stats: Record<string, number>
  reel: { slot: number; skill: string; star: number; category: Category }[]
}

export interface MonstersData {
  schemaVersion: number
  growthSpec: {
    perLevelUp: {
      mutations: number
      rareJump: { chance: number; effect: string }
    }
  }
  familyGrowthPools: Record<string, PoolEntry[]>
  monsters: Species[]
}
