// 技コスト(MP)とMP回復。ルーレット廃止→技を選ぶ方式の戦略性をMPで担保する。
import type { Panel } from '../types'

export const MP_REGEN = 3 // 自分の手番開始ごとに回復するMP

/** ★ランク→MPコスト（強い技ほど高い） */
const COST_BY_STAR: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7 }

export function moveCost(panel: Panel): number {
  if (panel.category === 'miss') return Infinity // ミス枠は選択不可
  return COST_BY_STAR[panel.star] ?? 2
}

/** レベルから最大MP（控えめに伸ばし、強技の連発を抑える） */
export function maxMpFor(level: number): number {
  return 8 + Math.floor(level / 2)
}

export function canAfford(mp: number, panel: Panel): boolean {
  return mp >= moveCost(panel)
}
