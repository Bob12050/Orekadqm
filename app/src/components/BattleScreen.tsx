// 4対4バトルのデモUI。エンジン(Battle)を縦式リールで駆動する。
// 敵タップでターゲットロック、スピンで行動、オートで自動進行。
import { useEffect, useReducer, useRef, useState } from 'react'
import { Battle } from '../battle/engine'
import { ATTRIBUTE_LABEL } from '../battle/attributes'
import { GAUGE_MAX, scoutStars } from '../battle/scout'
import { makeParty, makeUnitFromOwned } from '../battle/setup'
import type { BattleEvent, BattleUnit, UnitInit } from '../battle/types'
import { partyMonsters, recruitSpecies, useStore } from '../state/store'
import { VerticalReel, type VerticalReelHandle } from './VerticalReel'
import './BattleScreen.css'

// デモの敵編成（章コンテンツが入るまでの固定ステージ）
const ENEMIES: UnitInit[] = [
  { speciesId: 2, slot: 0, level: 7, side: 'enemy' }, // トゲリス(scout★2)
  { speciesId: 13, slot: 1, level: 9, side: 'enemy' }, // コロリン(タンク, scout★1=スカウト練習向き)
  { speciesId: 19, slot: 2, level: 7, side: 'enemy' }, // ピヨット(scout★1)
]
const RECRUIT_LEVEL = 5

function buildBattle(seed: string): Battle {
  const allies = partyMonsters()
    .slice(0, 4)
    .map((m, i) => makeUnitFromOwned(m, i))
  const enemies = makeParty(ENEMIES)
  return Battle.fromUnits([...allies, ...enemies], seed)
}

export default function BattleScreen() {
  useStore() // 編成/コレクション変更に追従
  const party = partyMonsters()
  const seedRef = useRef('arena-1')
  const bRef = useRef<Battle | null>(null)
  if (!bRef.current && party.length > 0) bRef.current = buildBattle(seedRef.current)
  const b = bRef.current

  const [turnKey, bump] = useReducer((x) => x + 1, 0)
  const [log, setLog] = useState<string[]>(['たたかい かいし！'])
  const [target, setTarget] = useState<string | null>(null)
  const [auto, setAuto] = useState(false)
  const [busy, setBusy] = useState(false)
  const reelRef = useRef<VerticalReelHandle>(null)
  const busyRef = useRef(false)

  const pushEvents = (events: BattleEvent[]) => {
    const lines = events.filter((e) => 'text' in e).map((e) => (e as { text: string }).text)
    setLog((prev) => [...prev, ...lines].slice(-9))
  }

  // ターゲットが倒れたら解除
  useEffect(() => {
    if (b && target && !b.get(target)?.alive) setTarget(null)
  })

  // 敵の手番、または全オート時の味方手番を自動進行。
  // 注意: スケジュール前に setState しないこと（再レンダ→cleanupでtimeoutが取消され停止する）。
  useEffect(() => {
    if (!b || b.outcome !== 'ongoing' || busyRef.current) return
    const cur = b.current
    if (!cur) return
    if (cur.side === 'enemy') {
      busyRef.current = true
      const id = setTimeout(() => {
        pushEvents(b.takeEnemyTurn())
        busyRef.current = false
        bump()
      }, 650)
      return () => {
        clearTimeout(id)
        busyRef.current = false
      }
    }
    if (cur.side === 'ally' && auto) {
      const id = setTimeout(() => doSpin(), 450)
      return () => clearTimeout(id)
    }
    // turnKey(手番が解決するたび増加)と auto のみに依存。
    // target 等の無関係な再レンダで敵手番のtimeoutを取り消さないため。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, auto])

  function doSpin() {
    if (!b || busyRef.current || b.outcome !== 'ongoing') return
    const cur = b.current
    if (!cur || cur.side !== 'ally') return
    busyRef.current = true
    setBusy(true)
    const idx = b.autoPanelIndex()
    reelRef.current?.spinTo(idx, (stopped) => {
      const tgt = target && b.get(target)?.alive ? target : null
      pushEvents(b.takeAllyTurn(stopped, tgt))
      busyRef.current = false
      setBusy(false)
      bump()
    })
  }

  function doScout() {
    if (!b || busyRef.current || !target || !b.canScout(target)) return
    const foe = b.get(target)
    busyRef.current = true
    setBusy(true)
    // 演出: スカウトは手番を消費（リールは回さない）
    const ev = b.takeAllyScout(target)
    pushEvents(ev)
    if (ev.some((e) => e.t === 'scoutSuccess') && foe) {
      recruitSpecies(foe.speciesId, RECRUIT_LEVEL) // コレクションへ永続追加
      setTarget(null)
    }
    busyRef.current = false
    setBusy(false)
    bump()
  }

  function reset() {
    bRef.current = buildBattle(seedRef.current + ':' + Math.floor(performance.now()))
    busyRef.current = false
    setBusy(false)
    setTarget(null)
    setAuto(false)
    setLog(['たたかい かいし！'])
    bump()
  }

  if (!b) {
    return (
      <div className="battle">
        <div className="b-empty">「そだてる」タブで編成にコドモナを入れてね（最大4体）</div>
      </div>
    )
  }

  const enemies = b.side('enemy')
  const allies = b.side('ally')
  const cur = b.current
  const isAllyTurn = cur?.side === 'ally' && b.outcome === 'ongoing'
  const scoutInfo = target ? b.scoutFactorsFor(target) : null
  const canScoutNow = target ? b.canScout(target) : false
  const gaugePct = Math.round((b.scoutGauge / GAUGE_MAX) * 100)

  return (
    <div className="battle">
      <div className="b-round">
        ラウンド {b.round} ｜ {b.outcome === 'ongoing' ? (isAllyTurn ? `${cur?.name} の番` : '敵の番…') : '—'}
        {b.recruited.length > 0 && <span className="b-recruited">🤝 仲間 {b.recruited.length}</span>}
      </div>

      <div className={`b-gauge${b.gaugeReady ? ' ready' : ''}`}>
        <span className="b-gauge-label">スカウト</span>
        <div className="b-gauge-bar">
          <i style={{ width: `${gaugePct}%` }} />
        </div>
        <span className="b-gauge-val">{b.gaugeReady ? 'READY!' : `${gaugePct}%`}</span>
      </div>

      <div className="b-enemies">
        {enemies.map((u) => (
          <UnitCard
            key={u.uid}
            u={u}
            active={cur?.uid === u.uid}
            targeted={target === u.uid}
            isTarget
            onTap={() => u.alive && setTarget((t) => (t === u.uid ? null : u.uid))}
          />
        ))}
      </div>

      <div className="b-log">
        {log.map((l, i) => (
          <div key={i} className={i === log.length - 1 ? 'last' : ''}>
            {l}
          </div>
        ))}
      </div>

      <div className="b-allies">
        {allies.map((u) => (
          <UnitCard key={u.uid} u={u} active={cur?.uid === u.uid} targeted={false} onTap={() => {}} />
        ))}
      </div>

      <div className="b-reel-area">
        {b.outcome === 'ongoing' && isAllyTurn ? (
          <>
            <div className="b-target-hint">
              {target ? `🎯 ${b.get(target)?.name} を狙う` : '🎯 タップで敵を指定（未指定=おまかせ）'}
            </div>
            {scoutInfo && scoutInfo.scoutable && (
              <div className={`b-scout-rate${canScoutNow ? ' active' : ''}`}>
                🤝 スカウト成功率 {Math.round(scoutInfo.chance * 100)}%{' '}
                <span className="b-scout-stars">{'☆'.repeat(scoutStars(scoutInfo.chance))}</span>
                {!b.gaugeReady && <span className="b-scout-note">（ゲージ満タンで実行可）</span>}
                {b.gaugeReady && <span className="b-scout-note">（もっと弱らせる/状態異常で上がる）</span>}
              </div>
            )}
            <VerticalReel ref={reelRef} reel={cur!.reel} />
            <div className="b-buttons">
              <button className="b-spin" onClick={doSpin} disabled={busy}>
                🎰 スピン
              </button>
              <button className="b-scout" onClick={doScout} disabled={busy || !canScoutNow}>
                🤝 スカウト
              </button>
              <label className="b-auto">
                <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                オート
              </label>
            </div>
          </>
        ) : b.outcome !== 'ongoing' ? (
          <div className={`b-result ${b.outcome}`}>
            <div className="b-result-text">{b.outcome === 'win' ? '🏆 WIN！' : '💀 LOSE…'}</div>
            {b.recruited.length > 0 && (
              <div className="b-recruit-list">
                <div className="b-recruit-head">🤝 なかまになったコドモナ</div>
                {b.recruited.map((u) => (
                  <span key={u.uid} className="b-recruit-chip">
                    {u.name}（{ATTRIBUTE_LABEL[u.attribute]}/{u.rank}）
                  </span>
                ))}
              </div>
            )}
            <button className="b-spin" onClick={reset}>
              もう一度
            </button>
          </div>
        ) : (
          <div className="b-enemy-wait">敵の行動中…</div>
        )}
      </div>
    </div>
  )
}

function hpColor(ratio: number): string {
  if (ratio > 0.5) return '#66bb6a'
  if (ratio > 0.2) return '#ffca28'
  return '#ff5252'
}

function UnitCard({
  u,
  active,
  targeted,
  isTarget,
  onTap,
}: {
  u: BattleUnit
  active: boolean
  targeted: boolean
  isTarget?: boolean
  onTap: () => void
}) {
  const ratio = u.hp / u.maxHp
  return (
    <button
      className={`u-card${active ? ' active' : ''}${targeted ? ' targeted' : ''}${u.alive ? '' : ' fainted'}${isTarget ? ' tappable' : ''}`}
      onClick={onTap}
    >
      {targeted && <span className="u-lock">⊙</span>}
      <div className="u-name">
        {u.name} <span className="u-attr">{ATTRIBUTE_LABEL[u.attribute]}</span>
      </div>
      <div className="u-hpbar">
        <i style={{ width: `${ratio * 100}%`, background: hpColor(ratio) }} />
      </div>
      <div className="u-hp">
        {u.hp}/{u.maxHp}
      </div>
      {u.statuses.length > 0 && (
        <div className="u-status">
          {u.statuses.map((s, i) => (
            <span key={i} className={`st st-${s.kind}`}>
              {Battle.statusLabel(s.kind)}
            </span>
          ))}
        </div>
      )}
      {!u.alive && <span className="u-dead">×</span>}
    </button>
  )
}
