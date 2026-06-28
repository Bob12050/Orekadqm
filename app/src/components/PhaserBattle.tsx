// Phaser バトル本実装の React ホスト。store の編成 + 選択ステージでエンジンを組み、
// Phaser シーンへ渡す。クリア記録/初回報酬/スカウト永続/結果オーバーレイは React 側。
import { useEffect, useReducer, useRef, useState } from 'react'
import Phaser from 'phaser'
import { Battle } from '../battle/engine'
import { makeParty, makeUnitFromOwned } from '../battle/setup'
import {
  levelUpMonster, markCleared, markSeen, partyMonsters, recruitSpecies, useStore,
} from '../state/store'
import type { StageDef } from '../stages/stages'
import { BattleScene } from '../phaserBattle/BattleScene'
import './PhaserBattle.css'

const RECRUIT_LEVEL = 5

interface Props {
  stage: StageDef
  onExit: () => void
}

export default function PhaserBattle({ stage, onExit }: Props) {
  useStore()
  const party = partyMonsters()
  const hostRef = useRef<HTMLDivElement>(null)
  const battleRef = useRef<Battle | null>(null)
  const [outcome, setOutcome] = useState<'win' | 'lose' | null>(null)
  const [reward, setReward] = useState<string | null>(null)
  const [runKey, restart] = useReducer((x) => x + 1, 0)

  useEffect(() => {
    if (!hostRef.current || party.length === 0) return
    setOutcome(null)
    setReward(null)
    markSeen(stage.enemies.map((e) => e.speciesId))

    const allies = partyMonsters().slice(0, 4).map((m, i) => makeUnitFromOwned(m, i))
    const enemies = makeParty(stage.enemies)
    const battle = Battle.fromUnits([...allies, ...enemies], `${stage.id}-${runKey}`)
    battleRef.current = battle

    const scene = new BattleScene({
      battle,
      onRecruit: (speciesId) => recruitSpecies(speciesId, RECRUIT_LEVEL),
      onEnd: (o) => {
        setOutcome(o)
        if (o === 'win') {
          const first = markCleared(stage.id)
          if (first) {
            partyMonsters().forEach((m) => levelUpMonster(m.uid))
            setReward('初クリア報酬: 編成メンバーが成長した！')
          }
        }
      },
    })
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: 390,
      height: 640,
      backgroundColor: '#0e1230',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene,
      audio: { noAudio: true },
    })
    return () => game.destroy(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey])

  if (party.length === 0) {
    return (
      <div className="phaser-battle">
        <StageBar stage={stage} onExit={onExit} />
        <div className="pb-empty">「そだてる」タブで編成にコドモナを入れてね（最大4体）</div>
      </div>
    )
  }

  const recruited = battleRef.current?.recruited ?? []

  return (
    <div className="phaser-battle">
      <StageBar stage={stage} onExit={onExit} />
      <div ref={hostRef} className="pb-host" />
      {outcome && (
        <div className={`pb-overlay ${outcome}`}>
          {reward && <div className="pb-reward">{reward}</div>}
          {recruited.length > 0 && (
            <div className="pb-recruit">
              🤝 なかま: {recruited.map((u) => u.name).join('・')}
            </div>
          )}
          <div className="pb-overlay-btns">
            <button className="pb-btn ghost" onClick={() => restart()}>
              もう一度
            </button>
            <button className="pb-btn" onClick={onExit}>
              ステージへ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StageBar({ stage, onExit }: Props) {
  return (
    <div className="pb-stagebar">
      <button className="pb-back" onClick={onExit}>
        ← もどる
      </button>
      <span>
        {stage.boss ? '👑 ' : ''}
        {stage.title}（推奨Lv{stage.recommendedLv}）
      </span>
    </div>
  )
}
