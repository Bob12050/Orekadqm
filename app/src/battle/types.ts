// バトルエンジンの型。設計書5章準拠。UI非依存の純ロジック層。
import type { Panel } from '../types'

export type Attribute = 'fire' | 'water' | 'wind' | 'earth' | 'light' | 'dark' | 'none'
export type Side = 'ally' | 'enemy'

export type StatusKind =
  | 'poison' // 毒: 手番終了に割合ダメージ
  | 'paralyze' // 麻痺: 一定確率で行動不可
  | 'sleep' // 眠り: 行動不可、被弾で起床
  | 'confuse' // 混乱: ターゲットがランダム化
  | 'seal' // 封印: 必殺枠が出ない
  | 'blind' // 暗闇: 命中ダウン
  | 'atkUp'
  | 'atkDown'
  | 'defUp'
  | 'defDown'
  | 'haste' // 加速: 素早さUP
  | 'slow' // 鈍足: 素早さダウン

export interface Stats {
  hp: number
  atk: number
  def: number
  mag: number
  spd: number
  acc: number
  luck: number
}

export interface StatusInstance {
  kind: StatusKind
  remaining: number // 残りターン
  magnitude: number // バフ/デバフ倍率や毒割合など
}

export interface BattleUnit {
  uid: string
  name: string
  speciesId: number
  side: Side
  slot: number // 編成内の位置（0..3）
  attribute: Attribute
  family: string
  rank: string
  scoutStar: number // スカウト難度★(1易〜5難)
  scoutable: boolean // ボス/配合専用は false
  base: Stats
  hp: number
  maxHp: number
  reel: Panel[]
  statuses: StatusInstance[]
  alive: boolean
}

export type Outcome = 'ongoing' | 'win' | 'lose'

/** UI へ渡すバトルイベント（演出はこれを再生する。結果とは独立） */
export type BattleEvent =
  | { t: 'roundStart'; round: number; order: string[]; text: string }
  | { t: 'turnStart'; uid: string; text: string }
  | { t: 'incapacitated'; uid: string; reason: StatusKind; text: string }
  | { t: 'wakeUp'; uid: string; text: string }
  | { t: 'action'; uid: string; skill: string; category: string; targets: string[]; text: string }
  | { t: 'miss'; uid: string; target: string; text: string }
  | {
      t: 'damage'
      uid: string
      target: string
      amount: number
      crit: boolean
      berserk: boolean
      effectiveness: 'weak' | 'resist' | 'neutral'
      text: string
    }
  | { t: 'heal'; uid: string; target: string; amount: number; text: string }
  | { t: 'status'; uid: string; target: string; kind: StatusKind; text: string }
  | { t: 'buff'; uid: string; target: string; kind: StatusKind; text: string }
  | { t: 'drain'; uid: string; amount: number; text: string }
  | { t: 'poisonTick'; uid: string; amount: number; text: string }
  | { t: 'faint'; uid: string; text: string }
  | { t: 'scoutAttempt'; uid: string; target: string; chance: number; text: string }
  | { t: 'scoutSuccess'; target: string; name: string; text: string }
  | { t: 'scoutFail'; target: string; bond: number; text: string }
  | { t: 'outcome'; outcome: Outcome; text: string }

export interface UnitInit {
  speciesId: number
  level: number
  side: Side
  slot: number
  boss?: boolean // true ならスカウト不可（設計書 5-11 / 6-6）
}
