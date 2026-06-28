// 表示用ヘルパ（カテゴリの色・ラベル、★表記）。アート方針 11章の系統/分類色に準拠。

import type { Category } from '../types'

const CATEGORY_COLOR: Record<Category, string> = {
  attack: '#ff7043',
  magic: '#7e57c2',
  heal: '#66bb6a',
  buff: '#42a5f5',
  debuff: '#ab47bc',
  defense: '#8d99ae',
  support: '#ffd54f',
  ultimate: '#ffca28',
  miss: '#55607a',
}

const CATEGORY_LABEL: Record<Category, string> = {
  attack: '攻撃',
  magic: '魔法',
  heal: '回復',
  buff: '強化',
  debuff: '弱体',
  defense: '防御',
  support: '補助',
  ultimate: '必殺',
  miss: 'ミス',
}

export function categoryColor(c: Category): string {
  return CATEGORY_COLOR[c]
}

export function categoryLabel(c: Category): string {
  return CATEGORY_LABEL[c]
}

export function stars(n: number): string {
  return '★'.repeat(Math.max(0, Math.min(4, n)))
}

const ROLE_LABEL: Record<string, string> = {
  physical_attacker: '物理アタッカー',
  physical_counter: 'カウンター',
  speed_attacker: '速攻アタッカー',
  attacker: 'アタッカー',
  bruiser: '物理/耐久',
  ace_attacker: 'エースアタッカー',
  healer: 'ヒーラー',
  magic_attacker: '魔法アタッカー',
  debuffer: 'デバッファー',
  support_healer: 'サポート/回復',
  controller: '状態異常/拘束',
  guardian_healer: '全体回復/壁',
  tank: 'タンク',
  counter_tank: '反射タンク',
  wall_tank: '鉄壁タンク',
  balanced: 'バランス',
  physical_defender: '物理/防御',
  aoe_mage: '全体魔法',
  speed_disruptor: '速攻/撹乱',
  artillery: '砲撃アタッカー',
  trickster: '搦め手',
  drain_attacker: '吸収アタッカー',
  ace_debuffer: 'エース/状態異常',
  support_reviver: 'バフ/蘇生',
  aoe_healer_attacker: '全体回復/聖技',
  armored_attacker: '装甲アタッカー',
  omni_ace: '万能/切り札',
}

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role
}

export const FAMILY_LABEL: Record<string, string> = {
  beast: '獣', dragon: '竜', magic: '魔法', plant: '植物', material: '物質',
  aqua: '水棲', bird: '鳥', demon: '悪魔', spirit: '精霊', machine: '機械',
}

