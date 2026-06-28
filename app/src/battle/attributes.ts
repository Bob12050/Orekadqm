// 属性相性（設計書 5-9）。火→風→地→水→火 のループ、光⇔闇 相互、無は等倍。
import type { Attribute } from './types'

/** attacker が強く出られる相手（弱点ループ） */
const STRONG_AGAINST: Record<Attribute, Attribute | null> = {
  fire: 'wind',
  wind: 'earth',
  earth: 'water',
  water: 'fire',
  light: 'dark',
  dark: 'light',
  none: null,
}

export type Effectiveness = 'weak' | 'resist' | 'neutral'

/** 与ダメ倍率と効果区分を返す */
export function elementResult(attacker: Attribute, defender: Attribute): {
  multiplier: number
  effectiveness: Effectiveness
} {
  if (attacker === 'none' || defender === 'none') {
    return { multiplier: 1.0, effectiveness: 'neutral' }
  }
  if (STRONG_AGAINST[attacker] === defender) {
    return { multiplier: 1.5, effectiveness: 'weak' } // 弱点を突いた
  }
  if (STRONG_AGAINST[defender] === attacker) {
    return { multiplier: 0.66, effectiveness: 'resist' } // 相手に耐性
  }
  return { multiplier: 1.0, effectiveness: 'neutral' }
}

export const ATTRIBUTE_LABEL: Record<Attribute, string> = {
  fire: '火',
  water: '水',
  wind: '風',
  earth: '地',
  light: '光',
  dark: '闇',
  none: '無',
}
