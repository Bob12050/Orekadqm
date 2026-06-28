// Phaser バトル PoC の React ラッパ。store の編成 + デモ敵でエンジンを組み、Phaser シーンへ渡す。
import { useEffect, useReducer, useRef, useState } from 'react'
import Phaser from 'phaser'
import { Battle } from '../battle/engine'
import { makeParty, makeUnitFromOwned } from '../battle/setup'
import type { UnitInit } from '../battle/types'
import { partyMonsters, useStore } from '../state/store'
import { BattleScene } from '../phaserBattle/BattleScene'
import './PhaserBattle.css'

// PoC 用のやさしい敵（手触り確認向け）
const DEMO_ENEMIES: UnitInit[] = [
  { speciesId: 2, slot: 0, level: 6, side: 'enemy' }, // トゲリス
  { speciesId: 19, slot: 1, level: 6, side: 'enemy' }, // ピヨット
  { speciesId: 10, slot: 2, level: 5, side: 'enemy' }, // フタバナ
]

function buildBattle(): Battle {
  const allies = partyMonsters().slice(0, 4).map((m, i) => makeUnitFromOwned(m, i))
  const enemies = makeParty(DEMO_ENEMIES)
  return Battle.fromUnits([...allies, ...enemies], 'phaser-poc')
}

export default function PhaserBattle() {
  useStore()
  const party = partyMonsters()
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const [outcome, setOutcome] = useState<'win' | 'lose' | null>(null)
  const [runKey, restart] = useReducer((x) => x + 1, 0)

  useEffect(() => {
    if (!hostRef.current || party.length === 0) return
    setOutcome(null)
    const battle = buildBattle()
    const scene = new BattleScene({ battle, onEnd: (o) => setOutcome(o) })
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
    gameRef.current = game
    return () => {
      game.destroy(true)
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey])

  if (party.length === 0) {
    return <div className="pb-empty">「そだてる」タブで編成にコドモナを入れてね</div>
  }

  return (
    <div className="phaser-battle">
      <div className="pb-note">✨ Phaser 4 バトル PoC（演出の手触り確認用・別実装）</div>
      <div ref={hostRef} className="pb-host" />
      {outcome && (
        <button className="pb-restart" onClick={() => restart()}>
          もう一度
        </button>
      )}
    </div>
  )
}
