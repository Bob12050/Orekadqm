// ドロップ判定。データ駆動テーブル＋seedable RNG＋ボス初回確定ドロップ。
// 純TS。Vitest でシード固定して決定的に検証する。

import type { DropTableDef } from '../data/types.ts'
import type { Rng } from './rng.ts'

export interface DropResult {
  itemId: string
  count: number
  /** レア演出用（確定ドロップやレア度で光らせる）。 */
  special: boolean
}

/** 重み付き抽選で1エントリを選ぶ。 */
function weightedPick(table: DropTableDef, rng: Rng): DropResult | null {
  const total = table.entries.reduce((s, e) => s + e.weight, 0)
  if (total <= 0) return null
  let r = rng.next() * total
  for (const e of table.entries) {
    r -= e.weight
    if (r < 0) {
      return { itemId: e.itemId, count: rng.int(e.min, e.max), special: false }
    }
  }
  const last = table.entries[table.entries.length - 1]
  if (!last) return null
  return { itemId: last.itemId, count: rng.int(last.min, last.max), special: false }
}

export interface RollOptions {
  /** そのボスを初めて倒したか（確定ドロップ用）。 */
  firstKill?: boolean
  /** 抽選回数（通常敵は1、大型は複数）。 */
  rolls?: number
}

/** テーブルからドロップを判定する。 */
export function rollDrops(
  table: DropTableDef,
  rng: Rng,
  opts: RollOptions = {},
): DropResult[] {
  const out: DropResult[] = []
  if (opts.firstKill && table.guaranteedFirst) {
    out.push({ itemId: table.guaranteedFirst, count: 1, special: true })
  }
  const rolls = Math.max(1, opts.rolls ?? 1)
  for (let i = 0; i < rolls; i++) {
    const r = weightedPick(table, rng)
    if (r) out.push(r)
  }
  return mergeDrops(out)
}

/** 同一アイテムのスタックをまとめる。 */
export function mergeDrops(drops: readonly DropResult[]): DropResult[] {
  const map = new Map<string, DropResult>()
  for (const d of drops) {
    const cur = map.get(d.itemId)
    if (cur) {
      cur.count += d.count
      cur.special = cur.special || d.special
    } else {
      map.set(d.itemId, { ...d })
    }
  }
  return [...map.values()]
}

/** テーブルが「いつか」産出しうる全アイテムID（供給可能性テスト用）。 */
export function possibleOutputs(table: DropTableDef): string[] {
  const ids = new Set<string>()
  if (table.guaranteedFirst) ids.add(table.guaranteedFirst)
  for (const e of table.entries) ids.add(e.itemId)
  return [...ids]
}
