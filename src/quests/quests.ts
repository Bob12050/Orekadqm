// クエスト進行の純ロジック。受注→討伐カウント→達成。walkthrough テストで通しで検証する。

import type { GameData } from '../data/types.ts'
import type { QuestProgress, SaveData } from '../save/schema.ts'

export function getProgress(save: SaveData, questId: string): QuestProgress | undefined {
  return save.quests.find((q) => q.questId === questId)
}

/** クエストを受注する（既に受注済みなら何もしない）。 */
export function acceptQuest(save: SaveData, questId: string): boolean {
  if (getProgress(save, questId)) return false
  save.quests.push({ questId, progress: 0, done: false, accepted: true })
  return true
}

/** 敵討伐を記録し、達成に至ったクエストIDの配列を返す。 */
export function recordKill(save: SaveData, data: GameData, enemyId: string): string[] {
  const completed: string[] = []
  for (const qp of save.quests) {
    if (qp.done || !qp.accepted) continue
    const def = data.quests[qp.questId]
    if (!def || def.targetEnemy !== enemyId) continue
    qp.progress = Math.min(def.count, qp.progress + 1)
    if (qp.progress >= def.count) {
      qp.done = true
      completed.push(qp.questId)
    }
  }
  return completed
}

/** 受注中（未達成）のクエストID。 */
export function activeQuestIds(save: SaveData): string[] {
  return save.quests.filter((q) => q.accepted && !q.done).map((q) => q.questId)
}
