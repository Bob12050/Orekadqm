// HudScene（入力層）と WorldScene（ゲーム層）を繋ぐ共有入力状態。
// 移動はアナログ値、ボタンは「押した瞬間」のエッジフラグ。

export interface InputState {
  moveX: number
  moveY: number
  attack: boolean
  skill: boolean
  examine: boolean
  paused: boolean
}

export const input: InputState = {
  moveX: 0,
  moveY: 0,
  attack: false,
  skill: false,
  examine: false,
  paused: false,
}

/** 消費後にエッジフラグをクリア。 */
export function consumeEdges(): { attack: boolean; skill: boolean; examine: boolean } {
  const out = { attack: input.attack, skill: input.skill, examine: input.examine }
  input.attack = false
  input.skill = false
  input.examine = false
  return out
}
