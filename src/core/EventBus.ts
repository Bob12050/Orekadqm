// 疎結合連携は型付き EventBus のみで行う（巨大クラス禁止・責務ごと分割の要）。
// イベント名とペイロードを interface で定義する。

import type { Facing } from './constants.ts'

/** ゲーム全体で流れるイベントとペイロードの一覧。 */
export interface GameEvents {
  'player:moved': { x: number; y: number; facing: Facing }
  'player:hp-changed': { hp: number; maxHp: number }
  'player:mp-changed': { mp: number; maxMp: number }
  'player:leveled': { level: number }
  'player:exp-changed': { exp: number; next: number }
  'combat:damage': {
    targetId: string
    amount: number
    element: string
    crit: boolean
    x: number
    y: number
  }
  'combat:enemy-defeated': { enemyId: string; x: number; y: number }
  'loot:dropped': { itemId: string; x: number; y: number }
  'loot:collected': { itemId: string; count: number }
  'equipment:changed': { slot: string; instanceId: string | null }
  'sfx:play': { id: string }
  'game:save-requested': Record<string, never>
  'game:saved': { at: number }
  'toast': { text: string }
}

export type EventName = keyof GameEvents
type Handler<K extends EventName> = (payload: GameEvents[K]) => void

/** 最小の型付き pub/sub。Phaser 非依存。 */
export class EventBus {
  private readonly handlers = new Map<EventName, Set<Handler<EventName>>>()

  on<K extends EventName>(name: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(name)
    if (!set) {
      set = new Set()
      this.handlers.set(name, set)
    }
    set.add(handler as Handler<EventName>)
    return () => this.off(name, handler)
  }

  off<K extends EventName>(name: K, handler: Handler<K>): void {
    this.handlers.get(name)?.delete(handler as Handler<EventName>)
  }

  emit<K extends EventName>(name: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(name)
    if (!set) return
    for (const handler of [...set]) {
      ;(handler as Handler<K>)(payload)
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}

/** アプリ全体で共有する単一インスタンス。 */
export const bus = new EventBus()
