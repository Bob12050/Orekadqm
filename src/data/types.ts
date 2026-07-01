// 全データ定義の型。データはハードコードせず src/data/defs/*.json に置き、
// 不変の文字列IDで相互参照する。この型が JSON のスキーマ契約になる。

import type { Element } from '../combat/elements.ts'

/** 一次ステータス。 */
export interface BaseStats {
  str: number
  vit: number
  int: number
  dex: number
  luk: number
}

export type StatKey = keyof BaseStats

/** 派生ステータス（computeDerived の出力）。 */
export interface DerivedStats {
  maxHp: number
  maxMp: number
  physAtk: number
  magAtk: number
  def: number
  magDef: number
  accuracy: number
  evasion: number
  critRate: number // 0..1
  atkSpeed: number // 攻撃/秒
  moveSpeed: number // px/秒
}

/** 12種の武器タグ。 */
export const WEAPON_TAGS = [
  'sword',
  'axe',
  'spear',
  'katana',
  'staff',
  'wand',
  'mace',
  'dagger',
  'whip',
  'shuriken',
  'bow',
  'shield',
] as const
export type WeaponTag = (typeof WEAPON_TAGS)[number]

/** 装備の9スロット（頭/胴/手/腰/足/背/武器/装飾1/装飾2）。 */
export const EQUIP_SLOTS = [
  'head',
  'body',
  'hands',
  'waist',
  'feet',
  'back',
  'weapon',
  'acc1',
  'acc2',
] as const
export type EquipSlot = (typeof EQUIP_SLOTS)[number]

/** レア度 R1〜R10。 */
export type Rarity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

// ---- 各 def --------------------------------------------------------------

export type ItemKind = 'material' | 'consumable' | 'key'

export interface ItemDef {
  id: string
  name: string
  kind: ItemKind
  desc: string
  /** 最大スタック数。 */
  stack: number
  rarity: Rarity
}

export interface EquipmentDef {
  id: string
  name: string
  slot: EquipSlot
  rarity: Rarity
  /** 武器のみ。防具/装飾では省略。 */
  weaponTag?: WeaponTag
  /** 武器/一部装備の属性。 */
  element?: Element
  /** 一次ステ補正。 */
  statMods: Partial<BaseStats>
  /** 派生への直接加算（防御力など）。 */
  derivedMods?: Partial<DerivedStats>
  /** 装備に必要な職位 tier（レア度ゲート）。 */
  reqTier: number
  desc: string
}

export interface JobDef {
  id: string
  name: string
  tier: number // 1〜4
  branch: string // 戦士/魔法/僧侶/盗賊/テイマー系統
  /** 見た目テクスチャキー（職業固定方式）。PNGが無ければデフォ素体にフォールバック。 */
  appearance: string
  /** 職業の一次ステ補正（固定加算）。 */
  statBase: BaseStats
  /** レベルごとの一次ステ成長。 */
  statGrowth: BaseStats
  /** 装備可能な武器タグ。 */
  weaponTags: WeaponTag[]
  desc: string
}

export type SkillEffectType = 'damage' | 'heal' | 'buff' | 'projectile' | 'summon'

export interface SkillEffect {
  type: SkillEffectType
  /** damage/projectile: 威力係数、heal: 回復量、buff: 効果量。 */
  power: number
  /** buff の持続 (ms)。 */
  durationMs?: number
  /** projectile の弾速 (px/s)。 */
  projectileSpeed?: number
}

export interface SkillDef {
  id: string
  name: string
  branch: string
  reqLevel: number
  /** 前提スキルID（循環禁止）。 */
  prereq: string[]
  /** 習得に必要な最低職位 tier。 */
  minTier: number
  mpCost: number
  /** skill.element 優先 → 無ければ武器属性。 */
  element?: Element
  effect: SkillEffect
  desc: string
}

export type EnemyBehavior = 'chase' | 'wander' | 'boss'

export interface EnemyDef {
  id: string
  name: string
  level: number
  isBoss: boolean
  element: Element
  weakness?: Element
  resist?: Element
  base: BaseStats
  behavior: EnemyBehavior
  dropTable: string
  /** プレースホルダー生成用の見た目ヒント。実PNGがあれば上書きされる。 */
  visual: EnemyVisual
  exp: number
}

export interface EnemyVisual {
  /** 生成器が使うキー。実PNG public/assets/enemy/<sprite>.png があれば自動上書き。 */
  sprite: string
  /** 主色（HEX 文字列 "#rrggbb"）。 */
  color: string
  /** 体格 (px, 論理)。 */
  size: number
  /** シルエットの形。 */
  shape: 'slime' | 'beast' | 'flyer' | 'golem'
}

export interface DropEntry {
  itemId: string
  weight: number
  min: number
  max: number
}

export interface DropTableDef {
  id: string
  entries: DropEntry[]
  /** ボス初回確定ドロップ（装備 or アイテムID）。 */
  guaranteedFirst?: string
}

export type MapKind = 'town' | 'field' | 'arena'

export interface MapSpawn {
  enemy: string
  count: number
}

export interface MapDef {
  id: string
  name: string
  kind: MapKind
  /** タイル単位のサイズ。 */
  widthTiles: number
  heightTiles: number
  /** 地面/装飾のパレット（プレースホルダー生成用）。 */
  palette: MapPalette
  spawns: MapSpawn[]
  /** 出口（別マップへの遷移）。 */
  exits: MapExit[]
}

export interface MapPalette {
  ground: string
  groundAlt: string
  accent: string
  edge: string
}

export interface MapExit {
  toMap: string
  /** 出口タイル座標。 */
  tx: number
  ty: number
  label: string
}

export interface RecipeDef {
  id: string
  /** 生産される装備ID。 */
  output: string
  materials: { itemId: string; count: number }[]
  /** 強化元（下位装備を消費する場合）。 */
  upgradeFrom?: string
}

export type QuestKind = 'normal' | 'hunt'

export interface QuestDef {
  id: string
  name: string
  kind: QuestKind
  rank: 1 | 2 | 3 | 4 | 5 | 6 | 7
  targetEnemy: string
  count: number
  /** 討伐先アリーナ/フィールドのマップID。 */
  map: string
  rewardExp: number
  rewardItems: { itemId: string; count: number }[]
  desc: string
}

/** 全 def をまとめたデータベース。 */
export interface GameData {
  items: Record<string, ItemDef>
  equipment: Record<string, EquipmentDef>
  jobs: Record<string, JobDef>
  skills: Record<string, SkillDef>
  enemies: Record<string, EnemyDef>
  dropTables: Record<string, DropTableDef>
  maps: Record<string, MapDef>
  recipes: Record<string, RecipeDef>
  quests: Record<string, QuestDef>
}
