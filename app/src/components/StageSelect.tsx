// 章・ステージ選択（設計書4-3/4-4, 8章）。クリアで次が解放される。
import { useState } from 'react'
import { getChapters, allStagesInOrder, type StageDef } from '../stages/stages'
import { useStore } from '../state/store'
import './StageSelect.css'

const FAMILY_LABEL: Record<string, string> = {
  beast: '獣', dragon: '竜', magic: '魔', plant: '植', material: '物',
  aqua: '水', bird: '鳥', demon: '悪', spirit: '精', machine: '機',
}

export default function StageSelect({ onPick }: { onPick: (s: StageDef) => void }) {
  const { cleared, party } = useStore()
  const chapters = getChapters()
  const order = allStagesInOrder()
  const [chapterId, setChapterId] = useState(1)

  // 解放判定: 直前ステージがクリア済みなら解放。各章先頭は前章ボスのクリアで解放。
  const isUnlocked = (s: StageDef): boolean => {
    const idx = order.findIndex((x) => x.id === s.id)
    if (idx <= 0) return true
    return !!cleared[order[idx - 1].id]
  }
  const chapterUnlocked = (cid: number): boolean => {
    if (cid <= 1) return true
    const prevBoss = `c${cid - 1}-boss`
    return !!cleared[prevBoss]
  }

  const ch = chapters.find((c) => c.id === chapterId)!
  const partyEmpty = party.length === 0

  return (
    <div className="stagesel">
      {partyEmpty && <div className="ss-warn">「そだてる」タブで編成にコドモナを入れてね</div>}

      <div className="ss-chapters">
        {chapters.map((c) => {
          const unlocked = chapterUnlocked(c.id)
          const done = !!cleared[`c${c.id}-boss`]
          return (
            <button
              key={c.id}
              className={`ss-chip${c.id === chapterId ? ' on' : ''}${unlocked ? '' : ' locked'}`}
              onClick={() => unlocked && setChapterId(c.id)}
              disabled={!unlocked}
            >
              {done ? '★' : unlocked ? '' : '🔒'}
              {c.id}
            </button>
          )
        })}
      </div>

      <div className="ss-chapter-head">
        <div className="ss-title">
          第{ch.id}章 {ch.title}
        </div>
        <div className="ss-area">
          {ch.area} ・ 推奨Lv{ch.recommendedLv[0]}〜{ch.recommendedLv[1]} ・ 主要系統{' '}
          {ch.mainFamilies.map((f) => FAMILY_LABEL[f] ?? f).join('・')}
        </div>
      </div>

      <div className="ss-stages">
        {ch.stages.map((s) => {
          const unlocked = isUnlocked(s)
          const done = !!cleared[s.id]
          return (
            <button
              key={s.id}
              className={`ss-stage${s.boss ? ' boss' : ''}${unlocked ? '' : ' locked'}`}
              onClick={() => unlocked && !partyEmpty && onPick(s)}
              disabled={!unlocked || partyEmpty}
            >
              <div className="ss-stage-l">
                <div className="ss-stage-title">
                  {s.boss ? '👑 ' : ''}
                  {s.title}
                  {done && <span className="ss-clear">クリア★</span>}
                </div>
                <div className="ss-stage-sub">
                  推奨Lv{s.recommendedLv} ・ 敵{s.enemies.length}体 ・{' '}
                  {[...new Set(s.enemies.map((e) => e.speciesId))].length}種
                </div>
              </div>
              <div className="ss-stage-fam">
                {[...new Set(s.families)].slice(0, 3).map((f) => (
                  <span key={f} className={`ss-fam fam-${f}`}>
                    {FAMILY_LABEL[f] ?? f}
                  </span>
                ))}
              </div>
              {!unlocked && <span className="ss-lock">🔒</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
