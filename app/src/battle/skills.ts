// 技カタログ。リールのパネル(skill/star/category)を戦闘効果へ解決する。
// 既知の技は個別定義、未知の技は category+star から汎用効果を導出（どの技でも動く）。
import type { Panel } from '../types'
import type { StatusKind } from './types'

export type TargetShape =
  | 'enemySingle'
  | 'enemyAll'
  | 'enemyRandom'
  | 'self'
  | 'allySingle' // 最も傷ついた味方
  | 'allyAll'

export interface SkillDef {
  target: TargetShape
  damageType: 'phys' | 'magic' | 'none'
  power: number // 0 = 非ダメージ
  hits: number // enemyRandom の手数など
  status?: { kind: StatusKind; chance: number; duration: number; magnitude?: number }
  heal?: number // 対象 maxHp に対する割合（0..1）
  drain?: number // 与ダメに対する吸収割合
  buff?: { kind: StatusKind; duration: number; magnitude: number; target: 'self' | 'allyAll' }
}

// 個別定義（全体/ランダム/状態異常/回復/バフなど category だけでは表せないもの）
const CATALOG: Record<string, Partial<SkillDef>> = {
  // --- 全体攻撃 ---
  りゅうのいぶき: { target: 'enemyAll', damageType: 'phys' },
  りゅうせい: { target: 'enemyAll', damageType: 'magic' },
  フレイムバースト: { target: 'enemyAll', damageType: 'magic' },
  うずまき: { target: 'enemyAll', damageType: 'magic' },
  おおなみ: { target: 'enemyAll', damageType: 'magic' },
  うずしお: { target: 'enemyAll', damageType: 'magic', status: { kind: 'slow', chance: 0.6, duration: 2, magnitude: 0.75 } },
  シャドウレイン: { target: 'enemyAll', damageType: 'magic' },
  ルクスレイ: { target: 'enemyAll', damageType: 'magic' },
  いかずちのつばさ: { target: 'enemyAll', damageType: 'magic' },
  スプレッドショット: { target: 'enemyAll', damageType: 'phys' },
  オメガキャノン: { target: 'enemyAll', damageType: 'phys' },
  // --- ランダム複数 ---
  みだれ爪: { target: 'enemyRandom', damageType: 'phys', hits: 3, power: 0.5 },
  みだればね: { target: 'enemyRandom', damageType: 'phys', hits: 3, power: 0.5 },
  // --- 状態異常付与 ---
  どくのこな: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'poison', chance: 0.85, duration: 3, magnitude: 0.06 } },
  のろいのやいば: { damageType: 'phys', status: { kind: 'poison', chance: 0.7, duration: 3, magnitude: 0.06 } },
  ねむりのもや: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'sleep', chance: 0.7, duration: 3 } },
  らいめい: { target: 'enemySingle', damageType: 'magic', status: { kind: 'paralyze', chance: 0.6, duration: 2 } },
  くらやみ: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'blind', chance: 0.85, duration: 2 } },
  いたずら: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'blind', chance: 0.6, duration: 2 } },
  // --- デバフ ---
  うなり: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'atkDown', chance: 1, duration: 3, magnitude: 0.75 } },
  ほえる: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'atkDown', chance: 1, duration: 3, magnitude: 0.75 } },
  おどす: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'atkDown', chance: 1, duration: 3, magnitude: 0.75 } },
  よわらせのろい: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'atkDown', chance: 1, duration: 3, magnitude: 0.7 } },
  からめとる: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'slow', chance: 1, duration: 3, magnitude: 0.7 } },
  かぜおこし: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'slow', chance: 1, duration: 3, magnitude: 0.75 } },
  けむまき: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'blind', chance: 0.8, duration: 2 } },
  どろをかける: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'blind', chance: 0.8, duration: 2 } },
  しぶき: { target: 'enemySingle', damageType: 'none', power: 0, status: { kind: 'blind', chance: 0.6, duration: 2 } },
  // --- 自己/味方バフ ---
  はやがけ: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'haste', duration: 3, magnitude: 1.3, target: 'self' } },
  かたくなる: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.4, target: 'self' } },
  ためこむ: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.3, target: 'self' } },
  ふんばる: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 2, magnitude: 1.3, target: 'self' } },
  クリスタルガード: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.5, target: 'self' } },
  こうらガード: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.4, target: 'self' } },
  あわまく: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.3, target: 'self' } },
  そうこうてんかい: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.4, target: 'self' } },
  てっぺきガード: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.6, target: 'self' } },
  メタルボディ: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.5, target: 'self' } },
  オーバーヒート: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'atkUp', duration: 3, magnitude: 1.4, target: 'self' } },
  マナチャージ: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'atkUp', duration: 3, magnitude: 1.3, target: 'self' } },
  ロックオン: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'atkUp', duration: 3, magnitude: 1.3, target: 'self' } },
  まもりのうた: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.3, target: 'allyAll' } },
  めぶき: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.25, target: 'allyAll' } },
  だいちのまもり: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.35, target: 'allyAll' } },
  せいなるかご: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.4, target: 'allyAll' } },
  かみのまもり: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.4, target: 'allyAll' } },
  みずのまもり: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.3, target: 'allyAll' } },
  かぜのまもり: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.3, target: 'allyAll' } },
  やみのころも: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.3, target: 'self' } },
  アダプトシフト: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'atkUp', duration: 3, magnitude: 1.3, target: 'self' } },
  // --- 回復 ---
  ヒール: { target: 'allySingle', damageType: 'none', power: 0, heal: 0.35 },
  ライトヒール: { target: 'allySingle', damageType: 'none', power: 0, heal: 0.35 },
  きつけ: { target: 'allySingle', damageType: 'none', power: 0, heal: 0.25 },
  こうごうせい: { target: 'self', damageType: 'none', power: 0, heal: 0.3 },
  やどりぎ: { target: 'self', damageType: 'none', power: 0, heal: 0.3 },
  いやしのもり: { target: 'allyAll', damageType: 'none', power: 0, heal: 0.3 },
  スターヒール: { target: 'allyAll', damageType: 'none', power: 0, heal: 0.4 },
  リペアフィールド: { target: 'allyAll', damageType: 'none', power: 0, heal: 0.35 },
  リバイブ: { target: 'allyAll', damageType: 'none', power: 0, heal: 0.25 },
  きよめのひかり: { target: 'allyAll', damageType: 'none', power: 0, heal: 0.1 },
  まもりのひかり: { target: 'self', damageType: 'none', power: 0, buff: { kind: 'defUp', duration: 3, magnitude: 1.3, target: 'allyAll' } },
  // --- 吸収 ---
  ドレインクロー: { target: 'enemySingle', damageType: 'phys', drain: 0.5 },
  // --- 必殺 ---
  きずなの牙: { target: 'enemySingle', damageType: 'phys', power: 2.2 },
  きずなの咆哮: { target: 'enemyAll', damageType: 'phys', power: 1.8 },
  やみのいちげき: { target: 'enemySingle', damageType: 'magic', power: 2.4 },
  オーバーオメガ: { target: 'enemyAll', damageType: 'phys', power: 2.0 },
}

/** category+star からの汎用既定値 */
function generic(panel: Panel): SkillDef {
  const s = panel.star
  switch (panel.category) {
    case 'attack':
      return { target: 'enemySingle', damageType: 'phys', power: 0.8 + s * 0.25, hits: 1 }
    case 'magic':
      return { target: 'enemySingle', damageType: 'magic', power: 0.8 + s * 0.25, hits: 1 }
    case 'ultimate':
      return { target: 'enemySingle', damageType: 'phys', power: 1.5 + s * 0.35, hits: 1 }
    case 'heal':
      return { target: 'allySingle', damageType: 'none', power: 0, hits: 1, heal: 0.2 + s * 0.06 }
    case 'buff':
    case 'defense':
      return { target: 'self', damageType: 'none', power: 0, hits: 1, buff: { kind: 'defUp', duration: 3, magnitude: 1.3, target: 'self' } }
    case 'support':
      return { target: 'allyAll', damageType: 'none', power: 0, hits: 1, heal: 0.1 }
    case 'debuff':
      return { target: 'enemySingle', damageType: 'none', power: 0, hits: 1, status: { kind: 'atkDown', chance: 1, duration: 3, magnitude: 0.8 } }
    case 'miss':
    default:
      return { target: 'self', damageType: 'none', power: 0, hits: 1 }
  }
}

/** パネルを完全な SkillDef へ解決（個別定義 > 汎用） */
export function resolveSkill(panel: Panel): SkillDef {
  const base = generic(panel)
  const override = CATALOG[panel.skill]
  if (!override) return base
  return { ...base, ...override }
}
