// 縦式リールの停止解決（純ロジック）。アニメーションは UI 側、結果はここで確定。
// 設計書 5-3「停止パネルは事前抽選で確定し、演出は後追い」を実装。

import type { Panel } from '../types'
import { randInt, type Rng } from './seededRng'

export interface StopResult {
  index: number
  panel: Panel
  isMiss: boolean
}

/** おまかせ停止：均等抽選で停止位置を確定 */
export function autoStopIndex(reelLength: number, rng: Rng): number {
  return randInt(rng, reelLength)
}

/** 指定位置のパネルを解決 */
export function resolveStop(reel: readonly Panel[], index: number): StopResult {
  const panel = reel[((index % reel.length) + reel.length) % reel.length]
  return { index, panel, isMiss: panel.category === 'miss' }
}

/** リールの「強さ」目安（★合計／パネル数）。育成の伸びを可視化するための簡易指標 */
export function reelPower(reel: readonly Panel[]): number {
  if (reel.length === 0) return 0
  const sum = reel.reduce((s, p) => s + (p.category === 'miss' ? 0 : p.star), 0)
  return Math.round((sum / reel.length) * 100) / 100
}
