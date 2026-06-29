// コドモナ（手持ち管理）。一覧→個体詳細：ステータス・技セット・技習得・覚醒・編成。
// 「そだてる」を作り直したもの（リール/スピン/ランダムLvアップは撤去）。
import { useState } from 'react'
import { ATTRIBUTE_LABEL } from '../battle/attributes'
import { moveCost, maxMpFor } from '../battle/cost'
import { ownedPower } from '../state/collection'
import { getSpeciesById } from '../data/monsters'
import {
  awaken, AWAKEN_LV, canAwaken, forgetSkill, learnSkill, learnableSkills, MAX_MOVES,
  PARTY_LIMIT, toggleParty, useStore,
} from '../state/store'
import { categoryLabel, FAMILY_LABEL, stars } from './display'
import './CollectionScreen.css'

export default function CollectionScreen() {
  const { monsters, party } = useStore()
  const [selUid, setSelUid] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const sel = monsters.find((m) => m.uid === selUid) ?? monsters[0] ?? null
  if (!sel) {
    return <div className="col-empty">コドモナがいません。バトルでスカウトするか、配合で生み出そう。</div>
  }
  const sp = getSpeciesById(sel.speciesId)!
  const inParty = party.includes(sel.uid)
  const moves = sel.reel.filter((p) => p.category !== 'miss')
  const learnable = learnableSkills(sel.uid)

  const f = 1 + (sel.level - 1) * 0.08
  const st = sp.stats
  const stats: [string, number][] = [
    ['HP', Math.round(st.hp * f)], ['MP', maxMpFor(sel.level)],
    ['攻', Math.round(st.atk * f)], ['防', Math.round(st.def * f)],
    ['魔', Math.round(st.mag * f)], ['速', Math.round(st.spd * f)],
  ]

  function doLearn(skill: string) {
    if (learnSkill(sel!.uid, skill)) setMsg(`「${skill}」を覚えた！`)
    else setMsg(moves.length >= MAX_MOVES ? `技は最大${MAX_MOVES}つ。忘れてから覚えてね` : '覚えられない')
  }
  function doForget(skill: string) {
    if (forgetSkill(sel!.uid, skill)) setMsg(`「${skill}」を忘れた`)
  }
  function doAwaken() {
    const r = awaken(sel!.uid)
    if (r) setMsg(`✦覚醒！「${r.added}」を得た！`)
  }

  return (
    <div className="col">
      <div className="col-partybar">
        編成 {party.length}/{PARTY_LIMIT}
        <span className="col-party-names">
          {party.map((uid) => monsters.find((m) => m.uid === uid)?.name).filter(Boolean).join('・') || '（空）'}
        </span>
      </div>

      <div className="col-detail">
        <div className="col-head">
          <div className={`col-name${sel.awakened ? ' awakened' : ''}`}>
            {sel.awakened && <span className="col-awk">✦</span>}
            {sel.name}
          </div>
          <div className="col-meta">
            {FAMILY_LABEL[sp.family]}系 ・ ランク{sp.rank} ・ Lv{sel.level} ・ {ATTRIBUTE_LABEL[sel.attribute]}
            {sel.subAttribute ? `+${ATTRIBUTE_LABEL[sel.subAttribute]}` : ''}
            {sel.generation > 0 ? ` ・ ${sel.generation}世代` : ''}
          </div>
        </div>

        <div className="col-stats">
          {stats.map(([k, v]) => (
            <div key={k} className="col-stat">
              <span className="col-stat-k">{k}</span>
              <span className="col-stat-v">{v}</span>
            </div>
          ))}
        </div>

        <button className={`col-party-btn ${inParty ? 'out' : 'in'}`} onClick={() => toggleParty(sel.uid)} disabled={!inParty && party.length >= PARTY_LIMIT}>
          {inParty ? '編成から外す' : '編成に入れる'}
        </button>

        {sel.awakened ? (
          <div className="col-awk-banner">✦ 覚醒済み ・ ステータス強化</div>
        ) : canAwaken(sel.uid) ? (
          <button className="col-awaken" onClick={doAwaken}>✦ 覚醒する！（Lv{AWAKEN_LV}到達）</button>
        ) : (
          <div className="col-awk-hint">Lv{AWAKEN_LV} で覚醒できる（ステ強化＋技1つ）</div>
        )}

        <div className="col-section">
          <div className="col-sec-head">技セット（{moves.length}/{MAX_MOVES}）</div>
          {moves.map((p, i) => (
            <div key={i} className={`col-move cat-${p.category}`}>
              <span className="col-move-cost">{moveCost(p)}</span>
              <span className="col-move-name">{stars(p.star)} {p.skill}</span>
              <span className="col-move-cat">{categoryLabel(p.category)}</span>
              {moves.length > 1 && (
                <button className="col-forget" onClick={() => doForget(p.skill)} title="忘れる">×</button>
              )}
            </div>
          ))}
        </div>

        <div className="col-section">
          <div className="col-sec-head">習得できる技</div>
          {learnable.length === 0 ? (
            <p className="col-muted">いまは習得できる技がありません（Lvが上がると増えます）</p>
          ) : (
            learnable.map((p) => (
              <button
                key={p.skill}
                className={`col-learn cat-${p.category}`}
                onClick={() => doLearn(p.skill)}
                disabled={moves.length >= MAX_MOVES}
              >
                <span className="col-move-cost">{moveCost({ skill: p.skill, star: p.star, category: p.category })}</span>
                <span className="col-move-name">{stars(p.star)} {p.skill}</span>
                <span className="col-learn-add">＋習得</span>
              </button>
            ))
          )}
        </div>

        {msg && <div className="col-msg">{msg}</div>}
      </div>

      <div className="col-collection">
        <div className="col-sec-head">コレクション {monsters.length}体</div>
        <div className="col-grid">
          {monsters.map((m) => {
            const msp = getSpeciesById(m.speciesId)
            return (
              <button
                key={m.uid}
                className={`col-card${m.uid === sel.uid ? ' sel' : ''}${party.includes(m.uid) ? ' inparty' : ''}`}
                onClick={() => { setSelUid(m.uid); setMsg('') }}
              >
                {party.includes(m.uid) && <span className="col-card-badge">編成</span>}
                <div className="col-card-name">{m.awakened && <span className="col-awk">✦</span>}{m.name}</div>
                <div className="col-card-sub">
                  {msp?.family}/{msp?.rank} Lv{m.level}{m.generation > 0 ? ` ・${m.generation}世代` : ''} ・ ★{ownedPower(m).toFixed(1)}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
