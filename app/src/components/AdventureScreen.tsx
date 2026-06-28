// ぼうけん: ステージ選択 ↔ バトル のナビゲーション。
import { useState } from 'react'
import BattleScreen from './BattleScreen'
import StageSelect from './StageSelect'
import type { StageDef } from '../stages/stages'

export default function AdventureScreen() {
  const [stage, setStage] = useState<StageDef | null>(null)

  if (stage) {
    return <BattleScreen stage={stage} onExit={() => setStage(null)} />
  }
  return <StageSelect onPick={setStage} />
}
