// オレカ式ランダム成長：レベルアップごとにリールの1パネルが別の技/上位技へ変化する。
// 純関数。乱数は Rng を注入してテスト可能にする（DD-001 / 設計書 10-3）。

import type { Panel, PoolEntry } from '../types'
import { randInt, type Rng } from './seededRng'

export interface GrowthOptions {
  /** 飛び級・必殺出現の確率（既定 0.08 = growthSpec.perLevelUp.rareJump.chance） */
  rareJumpChance?: number
  /** 同等以上の★が出やすいバイアス（既定 0.7） */
  upgradeBias?: number
}

export interface GrowthResult {
  reel: Panel[] // 変化後のリール（新しい配列。元は破壊しない）
  mutatedIndex: number | null // 変化したパネルの位置（なければ null）
  before: Panel | null
  after: Panel | null
  rareJump: boolean // 飛び級が起きたか
}

const DEFAULTS: Required<GrowthOptions> = {
  rareJumpChance: 0.08,
  upgradeBias: 0.7,
}

/**
 * レベルアップ1回ぶんの変化を適用する。
 * - ロック中パネルは対象外。
 * - 変化先は同 family のプール＋同属性が出やすいよう、呼び出し側でプールを絞って渡す想定。
 * - rareJump 時は ★3 以上（なければ最大★）から抽選。
 * - 通常時は upgradeBias の確率で「現★以上」のエントリから、それ以外は全体から抽選。
 * - 可能な限り現在と異なる技を選ぶ。
 */
export function levelUpMutate(
  reel: readonly Panel[],
  pool: readonly PoolEntry[],
  rng: Rng,
  opts: GrowthOptions = {},
): GrowthResult {
  const { rareJumpChance, upgradeBias } = { ...DEFAULTS, ...opts }
  const next: Panel[] = reel.map((p) => ({ ...p, isNew: false }))

  const candidates = next
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.locked)
    .map(({ i }) => i)

  if (candidates.length === 0 || pool.length === 0) {
    return { reel: next, mutatedIndex: null, before: null, after: null, rareJump: false }
  }

  const idx = candidates[randInt(rng, candidates.length)]
  const current = next[idx]
  const before: Panel = { ...current }

  const rareJump = rng() < rareJumpChance

  let poolFiltered: PoolEntry[]
  if (rareJump) {
    const high = pool.filter((e) => e.star >= 3)
    poolFiltered = high.length > 0 ? high : topStar(pool)
  } else if (rng() < upgradeBias) {
    const sameOrBetter = pool.filter((e) => e.star >= current.star)
    poolFiltered = sameOrBetter.length > 0 ? sameOrBetter : [...pool]
  } else {
    poolFiltered = [...pool]
  }

  // できるだけ現在と違う技を選ぶ
  const distinct = poolFiltered.filter((e) => e.skill !== current.skill)
  const chooseFrom = distinct.length > 0 ? distinct : poolFiltered
  const chosen = chooseFrom[randInt(rng, chooseFrom.length)]

  const after: Panel = {
    skill: chosen.skill,
    star: chosen.star,
    category: chosen.category,
    locked: false,
    isNew: true,
  }
  next[idx] = after

  return { reel: next, mutatedIndex: idx, before, after, rareJump }
}

function topStar(pool: readonly PoolEntry[]): PoolEntry[] {
  const max = pool.reduce((m, e) => Math.max(m, e.star), 0)
  return pool.filter((e) => e.star === max)
}

/** パネルのロック切り替え（純関数） */
export function toggleLock(reel: readonly Panel[], index: number): Panel[] {
  return reel.map((p, i) => (i === index ? { ...p, locked: !p.locked } : p))
}
