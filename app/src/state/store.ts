// コレクション・ストア（localStorage 永続 + useSyncExternalStore）。
// リール育成・配合・バトル・スカウトが共有する所持個体の単一ソース。
import { useSyncExternalStore } from 'react'
import { createOwned, type OwnedMonster } from './collection'
import { levelUpMutate } from '../reel/growth'
import { poolForFamily, rareJumpChance } from '../data/monsters'
import { getSpeciesById } from '../data/monsters'
import { createRng } from '../reel/seededRng'

export interface StoreState {
  monsters: OwnedMonster[]
  party: string[] // 出撃uid（最大4）
  dex: number[] // 発見/入手済みの speciesId
}

const KEY = 'kodomona-store-v1'
const PARTY_MAX = 4

const STARTER_IDS = [1, 7, 16, 13, 2, 4, 10, 19] // モコル/ポフィム/プカリオ/コロリン/トゲリス/ファイドラ/フタバナ/ピヨット

function seed(): StoreState {
  const monsters = STARTER_IDS.map((id, i) => createOwned(id, 6 + (i % 3)))
  return {
    monsters,
    party: monsters.slice(0, 4).map((m) => m.uid),
    dex: Array.from(new Set(STARTER_IDS)),
  }
}

function load(): StoreState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoreState
      if (parsed && Array.isArray(parsed.monsters)) return parsed
    }
  } catch {
    /* noop */
  }
  return seed()
}

let state: StoreState = load()
const listeners = new Set<() => void>()

function commit(next: StoreState): void {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

export function getState(): StoreState {
  return state
}

// ---- アクション ----
export function getMonster(uid: string): OwnedMonster | undefined {
  return state.monsters.find((m) => m.uid === uid)
}

export function addMonster(m: OwnedMonster): void {
  const dex = state.dex.includes(m.speciesId) ? state.dex : [...state.dex, m.speciesId]
  commit({ ...state, monsters: [...state.monsters, m], dex })
}

export function removeMonsters(uids: string[]): void {
  const set = new Set(uids)
  commit({
    ...state,
    monsters: state.monsters.filter((m) => !set.has(m.uid)),
    party: state.party.filter((p) => !set.has(p)),
  })
}

export function updateMonster(uid: string, patch: Partial<OwnedMonster>): void {
  commit({
    ...state,
    monsters: state.monsters.map((m) => (m.uid === uid ? { ...m, ...patch } : m)),
  })
}

export function setParty(uids: string[]): void {
  commit({ ...state, party: uids.slice(0, PARTY_MAX) })
}

export function toggleParty(uid: string): void {
  const inParty = state.party.includes(uid)
  if (inParty) {
    setParty(state.party.filter((p) => p !== uid))
  } else if (state.party.length < PARTY_MAX) {
    setParty([...state.party, uid])
  }
}

export function partyMonsters(): OwnedMonster[] {
  return state.party.map((uid) => getMonster(uid)).filter((m): m is OwnedMonster => !!m)
}

/** スカウト等で仲間化した種を新規個体としてコレクションへ */
export function recruitSpecies(speciesId: number, level = 1): OwnedMonster {
  const m = createOwned(speciesId, level)
  addMonster(m)
  return m
}

/** レベルアップ（オレカ式ランダム成長を1回適用して永続化） */
export function levelUpMonster(uid: string): { before: string; after: string } | null {
  const m = getMonster(uid)
  if (!m) return null
  const sp = getSpeciesById(m.speciesId)
  const pool = poolForFamily(sp?.family ?? 'beast')
  const rng = createRng(`${uid}:${m.level}:${Math.floor(Math.random() * 1e9)}`)
  const res = levelUpMutate(m.reel, pool, rng, { rareJumpChance })
  updateMonster(uid, { reel: res.reel, level: m.level + 1 })
  if (res.before && res.after) {
    return {
      before: res.before.category === 'miss' ? 'ミス' : res.before.skill,
      after: res.after.skill,
    }
  }
  return null
}

export function toggleLockPanel(uid: string, index: number): void {
  const m = getMonster(uid)
  if (!m) return
  updateMonster(uid, {
    reel: m.reel.map((p, i) => (i === index ? { ...p, locked: !p.locked } : p)),
  })
}

export function resetStore(): void {
  commit(seed())
}

export const PARTY_LIMIT = PARTY_MAX
