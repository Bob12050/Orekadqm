// スカウト（設計書6章）。成功率は純関数。低確率を粘らせない＝失敗で貯まる「絆ポイント」を加算。
// scoutChance = base × hpFactor × statusFactor × rankFactor × charmFactor + bondBonus（5%〜95%にクランプ）
import { clamp } from './formulas'
import type { BattleUnit } from './types'

export const GAUGE_MAX = 100

/** スカウト難度★(1易〜5難) → 基礎成功率 */
export function baseFromStar(star: number): number {
  const table: Record<number, number> = { 1: 0.55, 2: 0.45, 3: 0.35, 4: 0.22, 5: 0.12 }
  return table[star] ?? 0.3
}

/** 系統ごとの「なつきやすさ」係数（獣・精霊は高、竜・悪魔は手強い） */
const CHARM: Record<string, number> = {
  beast: 1.15,
  spirit: 1.15,
  aqua: 1.1,
  plant: 1.05,
  bird: 1.05,
  material: 1.0,
  machine: 1.0,
  magic: 1.0,
  dragon: 0.8,
  demon: 0.8,
}

const RANK_ORDER = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS']

export interface ScoutFactors {
  scoutable: boolean
  base: number
  hpFactor: number
  statusFactor: number
  rankFactor: number
  charmFactor: number
  bondBonus: number
  chance: number
}

/** 対象＋絆ポイントから成功率と内訳を求める（UIが要因を表示できるよう内訳も返す） */
export function scoutFactors(target: BattleUnit, bond: number): ScoutFactors {
  if (!target.scoutable || !target.alive) {
    return { scoutable: false, base: 0, hpFactor: 0, statusFactor: 0, rankFactor: 0, charmFactor: 0, bondBonus: 0, chance: 0 }
  }
  const hpRatio = target.hp / target.maxHp
  const base = baseFromStar(target.scoutStar)
  // HPが低いほど成功率UP（満タン=1.0, 瀕死≈2.2）。ただし撃破=不可（alive前提）。
  const hpFactor = 1 + (1 - hpRatio) * 1.2
  const hard = target.statuses.some((s) => s.kind === 'sleep' || s.kind === 'paralyze' || s.kind === 'confuse')
  const soft = target.statuses.some((s) => s.kind === 'blind' || s.kind === 'atkDown' || s.kind === 'slow' || s.kind === 'defDown')
  const statusFactor = hard ? 1.4 : soft ? 1.15 : 1
  const ri = Math.max(0, RANK_ORDER.indexOf(target.rank))
  const rankFactor = clamp(1 - ri * 0.04, 0.55, 1)
  const charmFactor = CHARM[target.family] ?? 1
  const bondBonus = bond * 0.03 // 失敗ごとに+3%（粘りが無駄にならない）
  const chance = clamp(base * hpFactor * statusFactor * rankFactor * charmFactor + bondBonus, 0.05, 0.95)
  return { scoutable: true, base, hpFactor, statusFactor, rankFactor, charmFactor, bondBonus, chance }
}

/** 成功率を☆1〜5の体感表示に変換（数字が苦手でも分かる） */
export function scoutStars(chance: number): number {
  if (chance < 0.15) return 1
  if (chance < 0.3) return 2
  if (chance < 0.5) return 3
  if (chance < 0.7) return 4
  return 5
}
