// 章・ステージ生成（設計書8章 / chapters.json）。各章を「複数の通常ステージ＋ボス」に展開。
// 敵編成は章メタ(主要系統/推奨強さ/ボス)から決定論的(ステージIDをシード)に生成する。
import chaptersData from '@data/chapters.json'
import { species } from '../data/monsters'
import { createRng, type Rng } from '../reel/seededRng'
import type { UnitInit } from '../battle/types'

const RANK_ORDER = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS']

export interface StageDef {
  id: string // 例: "c1-1", "c1-boss"
  chapterId: number
  index: number // 章内の通し番号(0始まり、ボスは最後)
  title: string
  recommendedLv: number
  families: string[]
  boss: boolean
  bossName?: string
  enemies: UnitInit[]
}

export interface ChapterView {
  id: number
  title: string
  area: string
  mainFamilies: string[]
  recommendedLv: [number, number]
  bossName: string
  stages: StageDef[]
}

interface RawChapter {
  id: number
  title: string
  area: string
  mainFamilies: string[]
  recommendedPower: { avgLv: string; minRank: string }
  boss: { name: string; family: string; attribute: string; gimmick?: string }
}

const SHIFT_CYCLE = ['fire', 'water', 'wind', 'earth'] as const

/** ボスの説明文からギミックを推定（全ボスにフェーズあり） */
function parseGimmicks(text: string): string[] {
  const g = ['phases']
  if (/召喚|とりまき/.test(text)) g.push('summon')
  if (/シフト|属性(を|変化)|弱点属性/.test(text)) g.push('attributeShift')
  return g
}

const RAW: RawChapter[] = (chaptersData as { chapters: RawChapter[] }).chapters

function parseLvRange(s: string): [number, number] {
  const m = s.match(/(\d+)\D+(\d+)/)
  if (m) return [Number(m[1]), Number(m[2])]
  const n = Number(s) || 5
  return [n, n + 5]
}

const playable = species.filter((s) => !s.fusionOnly)

function speciesInFamilies(families: string[]) {
  const pool = playable.filter((s) => families.includes(s.family))
  return pool.length > 0 ? pool : playable
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** 通常ステージの敵編成 */
function normalEnemies(rng: Rng, families: string[], level: number, count: number): UnitInit[] {
  const pool = speciesInFamilies(families)
  return Array.from({ length: count }, (_, i) => ({
    speciesId: pick(rng, pool).id,
    level: Math.max(1, level + (i % 2)),
    side: 'enemy' as const,
    slot: i,
  }))
}

/** ボスステージの敵編成（ボス＋取りまき） */
function bossEnemies(
  rng: Rng,
  ch: RawChapter,
  level: number,
  minions: number,
): UnitInit[] {
  // ボスは boss.family の最高ランク種、なければ主要系統から
  const bossPool = playable
    .filter((s) => s.family === ch.boss.family)
    .sort((a, b) => RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank))
  const bossSpecies = bossPool[0] ?? pick(rng, speciesInFamilies(ch.mainFamilies))
  const minionPool = speciesInFamilies(ch.mainFamilies)
  const minionId = pick(rng, minionPool).id
  const gimmicks = parseGimmicks(ch.boss.gimmick ?? '')
  // 属性シフトはボス属性を起点に4属性を巡回
  const startIdx = Math.max(0, SHIFT_CYCLE.indexOf(ch.boss.attribute as (typeof SHIFT_CYCLE)[number]))
  const shiftCycle = SHIFT_CYCLE.map((_, i) => SHIFT_CYCLE[(startIdx + i) % SHIFT_CYCLE.length])

  const enemies: UnitInit[] = [
    {
      speciesId: bossSpecies.id,
      level: level + 2,
      side: 'enemy',
      slot: 0,
      boss: true,
      hpMultiplier: 3 + ch.id * 0.3,
      name: ch.boss.name,
      gimmicks,
      shiftCycle: gimmicks.includes('attributeShift') ? (shiftCycle as never) : undefined,
      minionSpeciesId: gimmicks.includes('summon') ? minionId : undefined,
      minionLevel: level,
    },
  ]
  for (let i = 0; i < minions; i++) {
    enemies.push({ speciesId: pick(rng, minionPool).id, level, side: 'enemy', slot: i + 1 })
  }
  return enemies
}

function buildChapter(ch: RawChapter): ChapterView {
  const [lo, hi] = parseLvRange(ch.recommendedPower.avgLv)
  const normalCount = Math.min(4, 2 + Math.floor(ch.id / 3)) // 章が進むほど敵が増える
  const minions = Math.min(3, Math.floor(ch.id / 3) + 1)
  const NORMAL_STAGES = 3

  const stages: StageDef[] = []
  for (let k = 1; k <= NORMAL_STAGES; k++) {
    const level = Math.round(lo + ((hi - lo) * (k - 1)) / NORMAL_STAGES)
    const id = `c${ch.id}-${k}`
    stages.push({
      id,
      chapterId: ch.id,
      index: k - 1,
      title: `ステージ ${ch.id}-${k}`,
      recommendedLv: level,
      families: ch.mainFamilies,
      boss: false,
      enemies: normalEnemies(createRng(id), ch.mainFamilies, level, normalCount),
    })
  }
  const bossId = `c${ch.id}-boss`
  stages.push({
    id: bossId,
    chapterId: ch.id,
    index: NORMAL_STAGES,
    title: `ボス: ${ch.boss.name}`,
    recommendedLv: hi,
    families: [ch.boss.family, ...ch.mainFamilies],
    boss: true,
    bossName: ch.boss.name,
    enemies: bossEnemies(createRng(bossId), ch, hi, minions),
  })

  return {
    id: ch.id,
    title: ch.title,
    area: ch.area,
    mainFamilies: ch.mainFamilies,
    recommendedLv: [lo, hi],
    bossName: ch.boss.name,
    stages,
  }
}

let cache: ChapterView[] | null = null

export function getChapters(): ChapterView[] {
  if (!cache) cache = RAW.map(buildChapter)
  return cache
}

/** 全ステージを章順・ステージ順に並べた配列（解放判定用） */
export function allStagesInOrder(): StageDef[] {
  return getChapters().flatMap((c) => c.stages)
}

export function getStage(id: string): StageDef | undefined {
  return allStagesInOrder().find((s) => s.id === id)
}
