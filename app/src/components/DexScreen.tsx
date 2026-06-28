// 図鑑（設計書4-17）。未発見/発見/入手の3状態、系統別、コンプ率、詳細(出現章/スカウト難度/配合ヒント)。
import { useMemo, useState } from 'react'
import chaptersData from '@data/chapters.json'
import fusionRules from '@data/fusion_rules.json'
import { species } from '../data/monsters'
import { ATTRIBUTE_LABEL } from '../battle/attributes'
import { useStore, type DexState } from '../state/store'
import { FAMILY_LABEL, roleLabel } from './display'
import './DexScreen.css'

const FAMILIES = ['beast', 'dragon', 'magic', 'plant', 'material', 'aqua', 'bird', 'demon', 'spirit', 'machine']

interface RawChapter {
  id: number
  title: string
  mainFamilies: string[]
}
interface SpecialRecipe {
  resultSpeciesId?: number
  name: string
  hint?: string
}
const CHAPTERS = (chaptersData as { chapters: RawChapter[] }).chapters
const RECIPES = (fusionRules as { specialRecipes: SpecialRecipe[] }).specialRecipes

export default function DexScreen() {
  const { dex } = useStore()
  const [family, setFamily] = useState<string | null>(null)
  const [selId, setSelId] = useState<number | null>(null)

  const total = species.length
  const ownedCount = useMemo(() => species.filter((s) => dex[s.id] === 'owned').length, [dex])
  const foundCount = useMemo(() => species.filter((s) => dex[s.id]).length, [dex])

  const list = family ? species.filter((s) => s.family === family) : species

  if (selId != null) {
    const sp = species.find((s) => s.id === selId)!
    const st = dex[sp.id]
    return <DexDetail sp={sp} state={st} onBack={() => setSelId(null)} />
  }

  return (
    <div className="dex">
      <div className="dex-summary">
        <div>
          図鑑コンプ率 <b>{Math.round((ownedCount / total) * 100)}%</b>
        </div>
        <div className="dex-sub">
          入手 {ownedCount} ・ 発見 {foundCount} / 全{total}体
        </div>
        <div className="dex-bar">
          <i className="seen" style={{ width: `${(foundCount / total) * 100}%` }} />
          <i className="owned" style={{ width: `${(ownedCount / total) * 100}%` }} />
        </div>
      </div>

      <div className="dex-filter">
        <button className={family === null ? 'on' : ''} onClick={() => setFamily(null)}>
          全
        </button>
        {FAMILIES.map((f) => (
          <button key={f} className={family === f ? 'on' : ''} onClick={() => setFamily(f)}>
            {FAMILY_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="dex-grid">
        {list.map((sp) => {
          const st: DexState | undefined = dex[sp.id]
          return (
            <button
              key={sp.id}
              className={`dex-card ${st ?? 'unknown'} fam-${sp.family}`}
              onClick={() => st && setSelId(sp.id)}
              disabled={!st}
            >
              <span className="dex-no">No.{String(sp.id).padStart(2, '0')}</span>
              <span className="dex-name">{st ? sp.name : '？？？'}</span>
              {st && (
                <span className="dex-tags">
                  {FAMILY_LABEL[sp.family]}/{sp.rank}
                </span>
              )}
              {st === 'owned' && <span className="dex-badge owned">入手</span>}
              {st === 'seen' && <span className="dex-badge seen">発見</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DexDetail({
  sp,
  state,
  onBack,
}: {
  sp: (typeof species)[number]
  state: DexState | undefined
  onBack: () => void
}) {
  const appearChapters = CHAPTERS.filter((c) => c.mainFamilies.includes(sp.family))
  const recipe = RECIPES.find((r) => r.resultSpeciesId === sp.id)
  const owned = state === 'owned'

  return (
    <div className="dex-detail">
      <button className="dex-back" onClick={onBack}>
        ← 図鑑へ
      </button>
      <div className={`dex-hero fam-${sp.family}`}>
        <div className="dex-hero-no">No.{String(sp.id).padStart(2, '0')}</div>
        <div className="dex-hero-name">{sp.name}</div>
        <div className="dex-hero-meta">
          {FAMILY_LABEL[sp.family]}系 ・ ランク{sp.rank} ・ {ATTRIBUTE_LABEL[sp.attribute as keyof typeof ATTRIBUTE_LABEL]}
        </div>
        <div className="dex-hero-role">{roleLabel(sp.role)}</div>
        <span className={`dex-badge ${owned ? 'owned' : 'seen'}`}>{owned ? '入手済み' : '発見のみ'}</span>
      </div>

      <div className="dex-info">
        <div className="dex-row">
          <span className="dex-k">スカウト難度</span>
          <span className="dex-v">
            {sp.scout > 0 ? '★'.repeat(sp.scout) + '☆'.repeat(5 - sp.scout) : '配合専用（スカウト不可）'}
          </span>
        </div>
        <div className="dex-row">
          <span className="dex-k">初期わざ</span>
          <span className="dex-v">{sp.reel.map((p) => p.skill).filter((s) => s !== 'ミス').join('・')}</span>
        </div>
        <div className="dex-row">
          <span className="dex-k">出現しやすい章</span>
          <span className="dex-v">
            {appearChapters.length > 0 ? appearChapters.map((c) => `${c.id}章`).join('・') : '—'}
          </span>
        </div>
        <div className="dex-row">
          <span className="dex-k">配合</span>
          <span className="dex-v">
            {recipe ? `★特殊配合「${recipe.name}」${recipe.hint ? ` — ${recipe.hint}` : ''}` : '汎用配合で生まれることがある'}
          </span>
        </div>
      </div>
    </div>
  )
}
