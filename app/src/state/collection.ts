// 所持個体(OwnedMonster)モデル。種(Species)を参照しつつ、Lv・育ったリール・系譜を持つ。
import type { Attribute } from '../battle/types'
import { getSpeciesById, toRuntimeReel } from '../data/monsters'
import type { Panel } from '../types'

export interface OwnedMonster {
  uid: string
  speciesId: number
  name: string
  level: number
  reel: Panel[]
  attribute: Attribute
  subAttribute?: Attribute
  personality?: string
  generation: number // 配合世代(0=初期/スカウト)
  bornFrom?: [number, number] // 親の speciesId
}

let counter = 0
/** 衝突しにくい一意ID（ブラウザ実行なので Date.now/Math.random 可） */
export function newUid(): string {
  counter += 1
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 1e6).toString(36)
  return `m_${t}_${r}_${counter}`
}

/** 種から所持個体を生成 */
export function createOwned(
  speciesId: number,
  level = 1,
  extra: Partial<OwnedMonster> = {},
): OwnedMonster {
  const sp = getSpeciesById(speciesId)
  if (!sp) throw new Error(`unknown species: ${speciesId}`)
  return {
    uid: newUid(),
    speciesId,
    name: sp.name,
    level,
    reel: toRuntimeReel(sp),
    attribute: sp.attribute as Attribute,
    generation: 0,
    ...extra,
  }
}

/** リールの強さ目安（ミス除く★平均） */
export function ownedPower(m: OwnedMonster): number {
  if (m.reel.length === 0) return 0
  const sum = m.reel.reduce((s: number, p: Panel) => s + (p.category === 'miss' ? 0 : p.star), 0)
  return Math.round((sum / m.reel.length) * 100) / 100
}
