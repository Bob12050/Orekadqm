// 配合UI（設計書4-9/4-10, 7章）。親2体を選び、プレビュー→継承選択→実行→結果。
import { useMemo, useState } from 'react'
import { ATTRIBUTE_LABEL } from '../battle/attributes'
import { previewFusion, executeFusion } from '../fusion/fusion'
import { createRng } from '../reel/seededRng'
import { addMonster, removeMonsters, useStore } from '../state/store'
import { ownedPower, type OwnedMonster } from '../state/collection'
import { getSpeciesById } from '../data/monsters'
import { categoryLabel, stars } from './display'
import './FusionScreen.css'

export default function FusionScreen() {
  const { monsters } = useStore()
  const [aUid, setAUid] = useState<string | null>(null)
  const [bUid, setBUid] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [result, setResult] = useState<{ child: OwnedMonster; special: string | null } | null>(null)

  const a = monsters.find((m) => m.uid === aUid) ?? null
  const b = monsters.find((m) => m.uid === bUid) ?? null
  const preview = useMemo(() => (a && b ? previewFusion(a, b) : null), [a, b])

  function tapMonster(uid: string) {
    if (uid === aUid) return setAUid(null)
    if (uid === bUid) return setBUid(null)
    if (!aUid) return setAUid(uid)
    if (!bUid) return setBUid(uid)
    setAUid(uid) // 両方埋まっていたら親Aを置換
  }

  function toggleSkill(skill: string) {
    setChosen((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : prev.length < 2 ? [...prev, skill] : prev,
    )
  }

  function doFuse() {
    if (!a || !b) return
    const rng = createRng(`${a.uid}:${b.uid}:${Math.floor(Math.random() * 1e9)}`)
    const { child, preview: pv } = executeFusion(a, b, chosen, rng)
    removeMonsters([a.uid, b.uid]) // 親は旅立つ（図鑑には残る）
    addMonster(child)
    setResult({ child, special: pv.special?.name ?? null })
    setAUid(null)
    setBUid(null)
    setChosen([])
  }

  if (result) {
    const sp = getSpeciesById(result.child.speciesId)
    return (
      <div className="fusion-result">
        {result.special && <div className="fr-special">★ とくべつな配合！</div>}
        <div className="fr-egg">🥚 → ✨</div>
        <div className="fr-name">{result.child.name}</div>
        <div className="fr-meta">
          {sp?.family}/{result.child.generation}世代 ・ ランク{sp?.rank} ・ {ATTRIBUTE_LABEL[result.child.attribute]}
          {result.child.subAttribute ? `+${ATTRIBUTE_LABEL[result.child.subAttribute]}` : ''}
        </div>
        <ReelList reel={result.child.reel} />
        <div className="fr-lineage">
          系譜: {result.child.bornFrom?.map((id) => getSpeciesById(id)?.name).join(' × ')}
        </div>
        <button className="fusion-go" onClick={() => setResult(null)}>
          つづける
        </button>
      </div>
    )
  }

  return (
    <div className="fusion">
      <div className="fu-slots">
        <ParentSlot label="親A" m={a} onClear={() => setAUid(null)} />
        <div className="fu-plus">✚</div>
        <ParentSlot label="親B" m={b} onClear={() => setBUid(null)} />
      </div>

      {preview ? (
        <div className="fu-preview">
          <div className="fu-egg">🥚 → ?</div>
          <div className="fu-line">
            系統 <b>{preview.childFamily}</b> ／ ランク帯 <b>{preview.childRank}</b>
            {preview.rankBonus.total > 0 && <span className="fu-bonus">ランク+{preview.rankBonus.total}</span>}
          </div>
          <div className="fu-line">
            候補:{' '}
            {preview.candidates.slice(0, 4).map((c) => (
              <span key={c.id} className="fu-cand">
                {c.name}
              </span>
            ))}
          </div>
          <div className="fu-line">
            属性 <b>{ATTRIBUTE_LABEL[preview.attribute]}</b>
            {preview.subAttribute ? `（+${ATTRIBUTE_LABEL[preview.subAttribute]}の可能性）` : ''}
          </div>
          {preview.special && <div className="fu-special">★ この組み合わせは特別な配合！（{preview.special.name}）</div>}

          <div className="fu-inherit">
            <div className="fu-inherit-head">継承スキル（最大2つ）</div>
            <div className="fu-skills">
              {preview.inheritableSkills.map((s) => (
                <label key={s} className={`fu-skill${chosen.includes(s) ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(s)}
                    onChange={() => toggleSkill(s)}
                    disabled={!chosen.includes(s) && chosen.length >= 2}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div className="fu-warn">⚠ 親2体は旅立ちます（図鑑には残ります）</div>
          <button className="fusion-go" onClick={doFuse}>
            🧬 はいごうする
          </button>
        </div>
      ) : (
        <div className="fu-hint">下から親を2体えらんでね</div>
      )}

      <div className="fu-collection">
        <div className="fu-coll-head">コレクション（タップで親に指定）</div>
        <div className="fu-grid">
          {monsters.map((m) => {
            const sp = getSpeciesById(m.speciesId)
            const sel = m.uid === aUid ? 'A' : m.uid === bUid ? 'B' : null
            return (
              <button key={m.uid} className={`fu-card${sel ? ' sel' : ''}`} onClick={() => tapMonster(m.uid)}>
                {sel && <span className="fu-card-badge">{sel}</span>}
                <div className="fu-card-name">{m.name}</div>
                <div className="fu-card-sub">
                  {sp?.family}/{sp?.rank} ・ Lv{m.level} ・ ★{ownedPower(m).toFixed(1)}
                  {m.generation > 0 ? ` ・ ${m.generation}世代` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ParentSlot({ label, m, onClear }: { label: string; m: OwnedMonster | null; onClear: () => void }) {
  const sp = m ? getSpeciesById(m.speciesId) : null
  return (
    <div className={`fu-slot${m ? ' filled' : ''}`} onClick={() => m && onClear()}>
      <div className="fu-slot-label">{label}</div>
      {m ? (
        <>
          <div className="fu-slot-name">{m.name}</div>
          <div className="fu-slot-sub">
            {sp?.family}/{sp?.rank} Lv{m.level}
          </div>
        </>
      ) : (
        <div className="fu-slot-empty">タップで選択</div>
      )}
    </div>
  )
}

function ReelList({ reel }: { reel: OwnedMonster['reel'] }) {
  return (
    <ul className="fr-reel">
      {reel.map((p, i) => (
        <li key={i} className={`fr-panel cat-${p.category}${p.isNew ? ' is-new' : ''}`}>
          <span className="fr-stars">{p.category === 'miss' ? '—' : stars(p.star)}</span>
          <span className="fr-skill">{p.skill}</span>
          <span className="fr-cat">{categoryLabel(p.category)}</span>
          {p.isNew && <span className="fr-new">継承</span>}
        </li>
      ))}
    </ul>
  )
}
