import { useMemo, useRef, useState } from 'react'
import BattleScreen from './components/BattleScreen'
import { VerticalReel, type VerticalReelHandle } from './components/VerticalReel'
import { categoryLabel, stars } from './components/display'
import { getSpeciesById, poolForFamily, rareJumpChance, species, toRuntimeReel } from './data/monsters'
import { autoStopIndex, reelPower, resolveStop } from './reel/reelEngine'
import { levelUpMutate, toggleLock } from './reel/growth'
import { createRng } from './reel/seededRng'
import type { Panel } from './types'
import './App.css'

type Mode = 'auto' | 'manual'

export default function App() {
  const [speciesId, setSpeciesId] = useState(1)
  const sp = getSpeciesById(speciesId)!
  const [reel, setReel] = useState<Panel[]>(() => toRuntimeReel(sp))
  const [level, setLevel] = useState(1)
  const [mode, setMode] = useState<Mode>('auto')
  const [seed, setSeed] = useState('kodomona')
  const [spinCount, setSpinCount] = useState(0)
  const [result, setResult] = useState<string>('「スピン」でリールを回そう')
  const [resultKind, setResultKind] = useState<'idle' | 'hit' | 'miss' | 'ult'>('idle')
  const [growthLog, setGrowthLog] = useState<string[]>([])
  const [lastMutation, setLastMutation] = useState<{ index: number; before: Panel } | null>(null)
  const [manualRunning, setManualRunning] = useState(false)

  const [view, setView] = useState<'reel' | 'battle'>('reel')
  const reelRef = useRef<VerticalReelHandle>(null)

  // シード付き RNG（スピンごと・レベルアップごとに進める）。同シード→同結果で再現可能。
  const rngRef = useRef(createRng(seed))
  const resetRng = (s: string) => {
    rngRef.current = createRng(s)
  }

  const pool = useMemo(() => poolForFamily(sp.family), [sp.family])
  const power = reelPower(reel)

  function changeSpecies(id: number) {
    const s = getSpeciesById(id)!
    setSpeciesId(id)
    setReel(toRuntimeReel(s))
    setLevel(1)
    setResult('「スピン」でリールを回そう')
    setResultKind('idle')
    setGrowthLog([])
    setLastMutation(null)
    resetRng(seed)
  }

  function handleStopResolved(index: number) {
    const r = resolveStop(reel, index)
    if (r.isMiss) {
      setResult('ミス！ 行動失敗…（育成で化ける枠）')
      setResultKind('miss')
    } else if (r.panel.category === 'ultimate') {
      setResult(`必殺！ ${stars(r.panel.star)} ${r.panel.skill}！！`)
      setResultKind('ult')
    } else {
      setResult(`${stars(r.panel.star)} ${r.panel.skill}（${categoryLabel(r.panel.category)}）`)
      setResultKind('hit')
    }
  }

  function spinAuto() {
    if (reelRef.current?.isSpinning()) return
    const target = autoStopIndex(reel.length, rngRef.current)
    setSpinCount((c) => c + 1)
    setResult('…')
    setResultKind('idle')
    reelRef.current?.spinTo(target, handleStopResolved)
  }

  function manualPress() {
    if (manualRunning) {
      setManualRunning(false)
      reelRef.current?.stopManual(handleStopResolved)
    } else {
      setManualRunning(true)
      setResult('狙って「ストップ」！')
      setResultKind('idle')
      reelRef.current?.startManual()
    }
  }

  function levelUp() {
    const res = levelUpMutate(reel, pool, rngRef.current, { rareJumpChance })
    setReel(res.reel)
    setLevel((l) => l + 1)
    if (res.mutatedIndex != null && res.before && res.after) {
      setLastMutation({ index: res.mutatedIndex, before: res.before })
      const beforeTxt =
        res.before.category === 'miss' ? 'ミス' : `${stars(res.before.star)}${res.before.skill}`
      const arrow = res.rareJump ? ' ✨飛び級！' : ''
      setGrowthLog((log) =>
        [`Lv${level + 1}: ${beforeTxt} → ${stars(res.after!.star)}${res.after!.skill}${arrow}`, ...log].slice(0, 8),
      )
    } else {
      setGrowthLog((log) => [`Lv${level + 1}: 変化なし（全枠ロック）`, ...log].slice(0, 8))
    }
  }

  function rerollLast() {
    if (!lastMutation) return
    // 直近の変化前に戻してから、改めて同じ枠を変化させる（事故救済）
    const restored = reel.map((p, i) => (i === lastMutation.index ? { ...lastMutation.before } : p))
    const res = levelUpMutate(
      restored.map((p, i) => ({ ...p, locked: i === lastMutation.index ? false : true })),
      pool,
      rngRef.current,
      { rareJumpChance },
    )
    // ロックは便宜上の絞り込み。結果の locked 状態は元に戻す。
    const merged = res.reel.map((p, i) => ({ ...p, locked: reel[i].locked ?? false }))
    setReel(merged)
    if (res.after) {
      setGrowthLog((log) =>
        [`振り直し: → ${stars(res.after!.star)}${res.after!.skill}`, ...log].slice(0, 8),
      )
      setLastMutation({ index: lastMutation.index, before: lastMutation.before })
    }
  }

  function onToggleLock(i: number) {
    setReel((r) => toggleLock(r, i))
  }

  return (
    <div className="app">
      <header className="app-head">
        <h1>コドモナ・サーガ</h1>
        <p className="sub">プロトタイプ ｜ 縦式リール＋4対4バトルエンジン</p>
      </header>

      <div className="view-tabs">
        <button className={view === 'reel' ? 'on' : ''} onClick={() => setView('reel')}>
          リール育成
        </button>
        <button className={view === 'battle' ? 'on' : ''} onClick={() => setView('battle')}>
          4対4バトル
        </button>
      </div>

      {view === 'battle' && <BattleScreen />}

      {view === 'reel' && (
      <>
      <section className="picker">
        <label>
          コドモナ
          <select value={speciesId} onChange={(e) => changeSpecies(Number(e.target.value))}>
            {species.map((s) => (
              <option key={s.id} value={s.id}>
                #{String(s.id).padStart(2, '0')} {s.name}（{s.family}/{s.rank}）
              </option>
            ))}
          </select>
        </label>
        <div className="meta">
          <span>Lv {level}</span>
          <span>リール強さ {power.toFixed(2)}</span>
          <span>枠 {reel.length}</span>
        </div>
      </section>

      <VerticalReel ref={reelRef} reel={reel} />

      <div className={`result result-${resultKind}`}>{result}</div>

      <section className="controls">
        <div className="mode-toggle">
          <button className={mode === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}>
            おまかせ
          </button>
          <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>
            ストップ（手動）
          </button>
        </div>
        {mode === 'auto' ? (
          <button className="big primary" onClick={spinAuto}>
            🎰 スピン
          </button>
        ) : (
          <button className={`big ${manualRunning ? 'danger' : 'primary'}`} onClick={manualPress}>
            {manualRunning ? '✋ ストップ！' : '▶ スタート'}
          </button>
        )}
        <div className="spin-count">スピン {spinCount} 回</div>
      </section>

      <section className="grow">
        <div className="grow-row">
          <button className="grow-btn" onClick={levelUp}>
            ⬆ レベルアップ（1枠ランダム変化）
          </button>
          <button className="grow-btn ghost" onClick={rerollLast} disabled={!lastMutation}>
            🎲 直近を振り直し
          </button>
        </div>
        <label className="seed">
          シード
          <input
            value={seed}
            onChange={(e) => {
              setSeed(e.target.value)
              resetRng(e.target.value)
            }}
          />
          <button className="ghost small" onClick={() => resetRng(seed)}>
            リセット
          </button>
        </label>
      </section>

      <section className="reel-editor">
        <h2>リール編成（タップでロック）</h2>
        <ul>
          {reel.map((p, i) => (
            <li key={i} className={`edit-panel cat-${p.category}${p.isNew ? ' is-new' : ''}`}>
              <button className="lock" onClick={() => onToggleLock(i)} title="ロック切替">
                {p.locked ? '🔒' : '🔓'}
              </button>
              <span className="edit-stars">
                {p.category === 'miss' ? '—' : stars(p.star)}
              </span>
              <span className="edit-skill">{p.skill}</span>
              <span className="edit-cat">{categoryLabel(p.category)}</span>
              {p.isNew && <span className="edit-new">NEW</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="log">
        <h2>成長ログ</h2>
        {growthLog.length === 0 ? (
          <p className="muted">レベルアップでパネルが化けるとここに記録されます</p>
        ) : (
          <ul>
            {growthLog.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </section>
      </>
      )}

      <footer className="foot">
        データ源: <code>/data/monsters.json</code>（単一ソース）｜ 仕様: <code>docs/design-decisions.md</code> DD-001
      </footer>
    </div>
  )
}
