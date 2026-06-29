// リポジトリ直下の data/monsters.json（単一ソース）を読み込む。
import raw from '@data/monsters.json'
import type { MonstersData, Panel, Species } from '../types'

export const monstersData = raw as unknown as MonstersData

/** プロトタイプで使う種（MVP対象 #01〜#12 を先頭に） */
export const species: Species[] = monstersData.monsters

export function getSpeciesById(id: number): Species | undefined {
  return species.find((s) => s.id === id)
}

/** 種の初期 reel をランタイムの技セットへ変換（ミス枠は撤去：DD-005で選択式に） */
export function toRuntimeReel(s: Species): Panel[] {
  return s.reel
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .filter((p) => p.category !== 'miss')
    .map((p) => ({ skill: p.skill, star: p.star, category: p.category, locked: false, isNew: false }))
}

/** 系統別成長プール */
export function poolForFamily(family: string) {
  return monstersData.familyGrowthPools[family] ?? []
}

export const rareJumpChance = monstersData.growthSpec?.perLevelUp?.rareJump?.chance ?? 0.08
