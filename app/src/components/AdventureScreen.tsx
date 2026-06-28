// ぼうけん: ステージ選択 ↔ バトル のナビゲーション。
// バトルは Phaser 実装。重い Phaser を遅延ロードしてメニューは軽量に保つ。
import { lazy, Suspense, useState } from 'react'
import StageSelect from './StageSelect'
import type { StageDef } from '../stages/stages'

const PhaserBattle = lazy(() => import('./PhaserBattle'))

export default function AdventureScreen() {
  const [stage, setStage] = useState<StageDef | null>(null)

  if (stage) {
    return (
      <Suspense fallback={<div className="pb-loading">バトルを読み込み中…</div>}>
        <PhaserBattle stage={stage} onExit={() => setStage(null)} />
      </Suspense>
    )
  }
  return <StageSelect onPick={setStage} />
}
