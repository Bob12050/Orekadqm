// そだてる＋へんせい。コレクションの所持個体を選んで育成(レベルアップ/ロック)し、編成に出し入れする。
// レベルアップ・ロック・編成はストアに永続化され、配合・バトルと共有される。
import { useRef, useState } from 'react'
import { ATTRIBUTE_LABEL } from '../battle/attributes'
import { ownedPower } from '../state/collection'
import { getSpeciesById } from '../data/monsters'
import {
  awaken,
  AWAKEN_LV,
  canAwaken,
  levelUpMonster,
  PARTY_LIMIT,
  toggleLockPanel,
  toggleParty,
  useStore,
} from '../state/store'
import { categoryLabel, stars } from './display'
import { VerticalReel, type VerticalReelHandle } from './VerticalReel'
import './TrainScreen.css'

export default function TrainScreen() {
  const { monsters, party } = useStore()
  const [selUid, setSelUid] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<string>('「スピン」でリールを試せる')
  const reelRef = useRef<VerticalReelHandle>(null)

  const sel = monsters.find((m) => m.uid === selUid) ?? monsters[0] ?? null
  const inParty = sel ? party.includes(sel.uid) : false

  function spin() {
    if (!sel || reelRef.current?.isSpinning()) return
    const idx = Math.floor(Math.random() * sel.reel.length)
    reelRef.current?.spinTo(idx, (stopped) => {
      const p = sel.reel[stopped]
      setResult(p.category === 'miss' ? 'ミス！' : `${stars(p.star)} ${p.skill}（${categoryLabel(p.category)}）`)
    })
  }

  function levelUp() {
    if (!sel) return
    const r = levelUpMonster(sel.uid)
    if (r) setLog((l) => [`Lv↑: ${r.before} → ${r.after}`, ...l].slice(0, 8))
    else setLog((l) => ['Lv↑: 変化なし（全枠ロック）', ...l].slice(0, 8))
  }

  function doAwaken() {
    if (!sel) return
    const r = awaken(sel.uid)
    if (r) setLog((l) => [`✦覚醒！ ${sel.name} は「${r.added}」を得た！`, ...l].slice(0, 8))
  }

  if (!sel) {
    return <div className="train-empty">コドモナがいません。バトルでスカウトするか、配合で生み出そう。</div>
  }

  const sp = getSpeciesById(sel.speciesId)

  return (
    <div className="train">
      <div className="tr-partybar">
        編成 {party.length}/{PARTY_LIMIT}
        <span className="tr-party-names">
          {party.map((uid) => monsters.find((m) => m.uid === uid)?.name).filter(Boolean).join('・') || '（空）'}
        </span>
      </div>

      <div className="tr-detail">
        <div className="tr-head">
          <div className={`tr-name${sel.awakened ? ' awakened' : ''}`}>
            {sel.awakened && <span className="tr-awk-mark">✦</span>}
            {sel.name}
          </div>
          <div className="tr-meta">
            {sp?.family}/{sp?.rank} ・ Lv{sel.level} ・ {ATTRIBUTE_LABEL[sel.attribute]}
            {sel.subAttribute ? `+${ATTRIBUTE_LABEL[sel.subAttribute]}` : ''} ・ ★{ownedPower(sel).toFixed(2)}
            {sel.generation > 0 ? ` ・ ${sel.generation}世代` : ''}
          </div>
        </div>

        <VerticalReel ref={reelRef} reel={sel.reel} />
        <div className="tr-result">{result}</div>

        <div className="tr-actions">
          <button className="tr-btn" onClick={spin}>
            🎰 スピン
          </button>
          <button className="tr-btn primary" onClick={levelUp}>
            ⬆ レベルアップ
          </button>
          <button className={`tr-btn ${inParty ? 'danger' : 'go'}`} onClick={() => toggleParty(sel.uid)} disabled={!inParty && party.length >= PARTY_LIMIT}>
            {inParty ? '編成から外す' : '編成に入れる'}
          </button>
        </div>

        {sel.awakened ? (
          <div className="tr-awk-banner">✦ 覚醒済み ・ ステータス上昇＋枠拡張</div>
        ) : canAwaken(sel.uid) ? (
          <button className="tr-awaken" onClick={doAwaken}>
            ✦ 覚醒する！（Lv{AWAKEN_LV}到達）
          </button>
        ) : (
          <div className="tr-awk-hint">Lv{AWAKEN_LV} で覚醒できる（見た目・ステ・枠が一段強化）</div>
        )}

        <div className="tr-reel-edit">
          <div className="tr-sub">リール編成（タップでロック）</div>
          {sel.reel.map((p, i) => (
            <div key={i} className={`tr-panel cat-${p.category}${p.isNew ? ' is-new' : ''}`}>
              <button className="tr-lock" onClick={() => toggleLockPanel(sel.uid, i)}>
                {p.locked ? '🔒' : '🔓'}
              </button>
              <span className="tr-stars">{p.category === 'miss' ? '—' : stars(p.star)}</span>
              <span className="tr-skill">{p.skill}</span>
              <span className="tr-cat">{categoryLabel(p.category)}</span>
            </div>
          ))}
        </div>

        {log.length > 0 && (
          <div className="tr-log">
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>

      <div className="tr-collection">
        <div className="tr-sub">コレクション {monsters.length}体</div>
        <div className="tr-grid">
          {monsters.map((m) => {
            const msp = getSpeciesById(m.speciesId)
            return (
              <button
                key={m.uid}
                className={`tr-card${m.uid === sel.uid ? ' sel' : ''}${party.includes(m.uid) ? ' inparty' : ''}`}
                onClick={() => setSelUid(m.uid)}
              >
                {party.includes(m.uid) && <span className="tr-card-badge">編成</span>}
                <div className="tr-card-name">
                  {m.awakened && <span className="tr-awk-mark">✦</span>}
                  {m.name}
                </div>
                <div className="tr-card-sub">
                  {msp?.family}/{msp?.rank} Lv{m.level}
                  {m.generation > 0 ? ` ・${m.generation}世代` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
