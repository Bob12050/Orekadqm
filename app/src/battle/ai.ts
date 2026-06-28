// ターゲット選択AI（設計書 5-6）と敵の行動選択。
import { elementResult } from './attributes'
import { autoStopIndex } from '../reel/reelEngine'
import type { Rng } from '../reel/seededRng'
import type { BattleUnit } from './types'

/** 攻撃対象の自動選択：弱点を突ける敵を優先、なければ HP割合が最小の敵 */
export function pickAttackTarget(actor: BattleUnit, opponents: BattleUnit[], rng: Rng): BattleUnit | null {
  const alive = opponents.filter((u) => u.alive)
  if (alive.length === 0) return null

  const scored = alive.map((u) => {
    const elem = elementResult(actor.attribute, u.attribute)
    const hpRatio = u.hp / u.maxHp
    // 弱点ボーナス + 低HPほど高スコア（とどめ志向）
    const score = (elem.effectiveness === 'weak' ? 0.5 : elem.effectiveness === 'resist' ? -0.2 : 0) + (1 - hpRatio)
    return { u, score }
  })
  scored.sort((a, b) => b.score - a.score)
  // 同点はランダムに散らす
  const top = scored.filter((s) => Math.abs(s.score - scored[0].score) < 1e-6)
  return top[Math.floor(rng() * top.length)].u
}

/** 最も傷ついた味方（回復対象） */
export function pickWoundedAlly(allies: BattleUnit[]): BattleUnit | null {
  const alive = allies.filter((u) => u.alive)
  if (alive.length === 0) return null
  return alive.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b))
}

/** 敵のリール行動を選ぶ（おまかせ＝均等抽選） */
export function enemyPanelIndex(actor: BattleUnit, rng: Rng): number {
  return autoStopIndex(actor.reel.length, rng)
}
