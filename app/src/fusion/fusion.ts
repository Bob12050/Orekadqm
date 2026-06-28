// 配合（設計書7章）。汎用配合(系統×ランク×相性)を基盤に、特殊配合(限定レシピ)を重ねる。純ロジック。
import rules from '@data/fusion_rules.json'
import { species, getSpeciesById } from '../data/monsters'
import { createOwned, newUid, type OwnedMonster } from '../state/collection'
import type { Rng } from '../reel/seededRng'
import type { Attribute } from '../battle/types'
import type { Panel } from '../types'

const RANK_ORDER: string[] = rules.generic.rankOrder
const MATRIX: Record<string, Record<string, string>> = rules.generic.familyMatrix as never
const HIGH_AFFINITY: string[][] = rules.generic.highAffinityPairs
const MAX_BONUS: number = rules.generic.rankBonus.maxTotalBonus
const SUB_ATTR_CHANCE: number = rules.inheritance.attribute.subAttributeChance
const MAX_INHERIT: number = rules.inheritance.skill.maxInherit

export interface SpecialRecipe {
  id: string
  name: string
  resultSpeciesId?: number
  resultFamily: string
  resultRank: string
  resultAttribute?: string
  subAttribute?: string
  parents: { speciesA: number; speciesB: number; requiredItem?: string }
  conditions?: string[]
  hint?: string
}

export interface FusionCandidate {
  id: number
  name: string
  family: string
  rank: string
  attribute: Attribute
}

export interface FusionPreview {
  special: SpecialRecipe | null
  childFamily: string
  childRankIndex: number
  childRank: string
  rankBonus: { sameSpecies: boolean; highAffinity: boolean; bothHighLevel: boolean; total: number }
  candidates: FusionCandidate[]
  primary: FusionCandidate
  attribute: Attribute
  subAttribute?: Attribute
  inheritableSkills: string[]
}

function rankIndex(rank: string): number {
  return Math.max(0, RANK_ORDER.indexOf(rank))
}

function isHighAffinity(a: string, b: string): boolean {
  return HIGH_AFFINITY.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

function findSpecial(aId: number, bId: number): SpecialRecipe | null {
  const recipes = rules.specialRecipes as SpecialRecipe[]
  for (const r of recipes) {
    const { speciesA, speciesB } = r.parents
    if ((speciesA === aId && speciesB === bId) || (speciesA === bId && speciesB === aId)) {
      return r
    }
  }
  return null
}

/** 子系統×ランク帯の候補プール（厳密一致→無ければ最寄りランク） */
function candidatesFor(family: string, rIdx: number): FusionCandidate[] {
  const inFam = species.filter((s) => s.family === family && !s.fusionOnly)
  const pool = inFam.length > 0 ? inFam : species.filter((s) => !s.fusionOnly)
  const toCand = (s: (typeof species)[number]): FusionCandidate => ({
    id: s.id,
    name: s.name,
    family: s.family,
    rank: s.rank,
    attribute: s.attribute as Attribute,
  })
  const exact = pool.filter((s) => rankIndex(s.rank) === rIdx)
  if (exact.length > 0) return exact.map(toCand)
  const sorted = [...pool].sort(
    (a, b) => Math.abs(rankIndex(a.rank) - rIdx) - Math.abs(rankIndex(b.rank) - rIdx),
  )
  const best = Math.abs(rankIndex(sorted[0].rank) - rIdx)
  return sorted.filter((s) => Math.abs(rankIndex(s.rank) - rIdx) === best).map(toCand)
}

/** 親リールから継承候補スキル（ミス除く・重複排除） */
function inheritableSkills(a: OwnedMonster, b: OwnedMonster): string[] {
  const set = new Set<string>()
  for (const p of [...a.reel, ...b.reel]) {
    if (p.category !== 'miss') set.add(p.skill)
  }
  return [...set]
}

/** 配合プレビュー（結果の候補・ランク・継承候補を提示。完全固定でなく予測可能） */
export function previewFusion(a: OwnedMonster, b: OwnedMonster): FusionPreview {
  const special = findSpecial(a.speciesId, b.speciesId)
  const spA = getSpeciesById(a.speciesId)!
  const spB = getSpeciesById(b.speciesId)!

  if (special) {
    const cand = special.resultSpeciesId ? getSpeciesById(special.resultSpeciesId) : undefined
    const primary: FusionCandidate = cand
      ? { id: cand.id, name: cand.name, family: cand.family, rank: cand.rank, attribute: cand.attribute as Attribute }
      : { id: -1, name: special.name, family: special.resultFamily, rank: special.resultRank, attribute: (special.resultAttribute as Attribute) ?? 'none' }
    return {
      special,
      childFamily: special.resultFamily,
      childRankIndex: rankIndex(special.resultRank),
      childRank: special.resultRank,
      rankBonus: { sameSpecies: false, highAffinity: false, bothHighLevel: false, total: 0 },
      candidates: [primary],
      primary,
      attribute: primary.attribute,
      subAttribute: special.subAttribute as Attribute | undefined,
      inheritableSkills: inheritableSkills(a, b),
    }
  }

  // 汎用配合
  const childFamily = MATRIX[spA.family]?.[spB.family] ?? spA.family
  const sameSpecies = a.speciesId === b.speciesId
  const highAffinity = isHighAffinity(spA.family, spB.family)
  const bothHighLevel = a.level >= 10 && b.level >= 10
  const bonus = Math.min(
    MAX_BONUS,
    (sameSpecies ? 1 : 0) + (highAffinity ? 1 : 0) + (bothHighLevel ? 1 : 0),
  )
  const baseIdx = Math.floor((rankIndex(spA.rank) + rankIndex(spB.rank)) / 2)
  const childRankIndex = Math.min(RANK_ORDER.length - 1, baseIdx + bonus)
  const childRank = RANK_ORDER[childRankIndex]
  const candidates = candidatesFor(childFamily, childRankIndex)
  const primary = candidates[0]
  // 属性: 子種固有を主、親属性からサブ付与の可能性
  const attribute = primary.attribute
  const parentAttrs = [a.attribute, b.attribute].filter((x) => x !== attribute && x !== 'none')
  const subAttribute = parentAttrs.length > 0 ? parentAttrs[0] : undefined

  return {
    special: null,
    childFamily,
    childRankIndex,
    childRank,
    rankBonus: { sameSpecies, highAffinity, bothHighLevel, total: bonus },
    candidates,
    primary,
    attribute,
    subAttribute,
    inheritableSkills: inheritableSkills(a, b),
  }
}

/** 継承スキルを子リールへ適用（ミス枠→空き枠の順に差し込み、無ければ弱い枠を置換） */
function applyInheritance(reel: Panel[], skills: string[], a: OwnedMonster, b: OwnedMonster): Panel[] {
  const next = reel.map((p) => ({ ...p }))
  const findPanel = (skill: string): Panel | undefined =>
    [...a.reel, ...b.reel].find((p) => p.skill === skill)
  for (const skill of skills.slice(0, MAX_INHERIT)) {
    const src = findPanel(skill)
    if (!src) continue
    const inherited: Panel = { skill: src.skill, star: src.star, category: src.category, locked: false, isNew: true }
    // 既に同名があるならスキップ
    if (next.some((p) => p.skill === skill)) continue
    const missIdx = next.findIndex((p) => p.category === 'miss')
    if (missIdx >= 0) {
      next[missIdx] = inherited
      continue
    }
    // 最も弱い非必殺パネルを置換
    let weakest = -1
    let weakestStar = 99
    next.forEach((p, i) => {
      if (p.category !== 'ultimate' && p.star < weakestStar) {
        weakestStar = p.star
        weakest = i
      }
    })
    if (weakest >= 0) next[weakest] = inherited
  }
  return next
}

/** 配合実行：子個体を生成（候補から抽選、継承スキルを反映）。親は呼び出し側で消費する。 */
export function executeFusion(
  a: OwnedMonster,
  b: OwnedMonster,
  chosenSkills: string[],
  rng: Rng,
): { child: OwnedMonster; preview: FusionPreview } {
  const preview = previewFusion(a, b)
  // 候補から抽選（特殊配合で resultSpeciesId が無い場合は family/rank の代表種）
  const pick = preview.candidates[Math.floor(rng() * preview.candidates.length)] ?? preview.primary
  const speciesId = pick.id > 0 ? pick.id : preview.primary.id > 0 ? preview.primary.id : a.speciesId
  const base = createOwned(speciesId, 1)
  const subAttr =
    preview.subAttribute && rng() < SUB_ATTR_CHANCE ? preview.subAttribute : preview.subAttribute && preview.special ? preview.subAttribute : undefined

  const child: OwnedMonster = {
    ...base,
    uid: newUid(),
    reel: applyInheritance(base.reel, chosenSkills, a, b),
    attribute: preview.attribute,
    subAttribute: subAttr,
    generation: Math.max(a.generation, b.generation) + 1,
    bornFrom: [a.speciesId, b.speciesId],
  }
  return { child, preview }
}
