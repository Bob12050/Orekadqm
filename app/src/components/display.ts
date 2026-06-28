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
