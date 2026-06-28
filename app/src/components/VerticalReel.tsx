// 縦式リール（オレカ式）。円形回転ではなく、縦一列のパネルが上下にスクロールし
// 中央の停止ラインに来たパネルを実行する。アニメは UI、停止結果は呼び出し側で確定。

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Panel } from '../types'
import { categoryColor, categoryLabel, stars } from './display'
import './VerticalReel.css'

const PANEL_H = 64 // px
const VISIBLE = 3 // 表示パネル数（中央が停止ライン）
const CYCLE = 6 // 演出で巻くサイクル数

export interface VerticalReelHandle {
  /** おまかせ：指定 index を停止ラインに合わせて停止 */
  spinTo: (targetIndex: number, onDone: (index: number) => void) => void
  /** 手動：等速スクロール開始 */
  startManual: () => void
  /** 手動：現在ラインに最も近いパネルへ減速停止し index を返す */
  stopManual: (onDone: (index: number) => void) => void
  isSpinning: () => boolean
}

interface Props {
  reel: Panel[]
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export const VerticalReel = forwardRef<VerticalReelHandle, Props>(function VerticalReel(
  { reel },
  ref,
) {
  const n = reel.length
  const [offset, setOffset] = useState(0) // px（strip を上に動かす量）
  const offsetRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const spinningRef = useRef(false)
  const [spinning, setSpinning] = useState(false)

  const setOff = (v: number) => {
    offsetRef.current = v
    setOffset(v)
  }

  const cancel = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  useEffect(() => () => cancel(), [])

  // index を中央に合わせるための offset（VISIBLE=3 のとき offset=(p-1)*H）
  const offsetForStripPos = (p: number) => (p - 1) * PANEL_H

  useImperativeHandle(ref, () => ({
    isSpinning: () => spinningRef.current,

    spinTo(targetIndex, onDone) {
      if (spinningRef.current || n === 0) return
      spinningRef.current = true
      setSpinning(true)
      const start = offsetRef.current
      // 現在より下方向へ CYCLE 周ぶん回してから target に着地
      const startPos = start / PANEL_H + 1
      const baseCycle = Math.ceil(startPos / n) + CYCLE
      const finalStripPos = baseCycle * n + targetIndex
      const end = offsetForStripPos(finalStripPos)
      const dur = 1300
      const t0 = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / dur)
        setOff(start + (end - start) * easeOutCubic(t))
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          setOff(((end % (n * PANEL_H)) + n * PANEL_H) % (n * PANEL_H))
          spinningRef.current = false
          setSpinning(false)
          onDone(targetIndex)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    },

    startManual() {
      if (spinningRef.current || n === 0) return
      spinningRef.current = true
      setSpinning(true)
      const speed = 0.9 * PANEL_H // px/frame 相当（約 54px/frame）
      let last = performance.now()
      const loop = (now: number) => {
        const dt = Math.min(2.5, (now - last) / 16.67)
        last = now
        const v = (offsetRef.current + speed * dt) % (n * PANEL_H)
        setOff(v)
        if (spinningRef.current) rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    },

    stopManual(onDone) {
      if (!spinningRef.current || n === 0) return
      cancel()
      // 現在の中央位置から、次に来る整列位置へ短く減速
      const curPos = offsetRef.current / PANEL_H + 1
      const landStripPos = Math.ceil(curPos + 1.0)
      const targetIndex = ((Math.round(landStripPos) % n) + n) % n
      const start = offsetRef.current
      const end = offsetForStripPos(landStripPos)
      const dur = 420
      const t0 = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / dur)
        setOff(start + (end - start) * easeOutCubic(t))
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          setOff(((end % (n * PANEL_H)) + n * PANEL_H) % (n * PANEL_H))
          spinningRef.current = false
          setSpinning(false)
          onDone(targetIndex)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    },
  }))

  // 連続スクロール表現のため strip を複数サイクル描画
  const strip: { panel: Panel; key: string }[] = []
  const totalCycles = CYCLE + 4
  for (let c = 0; c < totalCycles; c++) {
    for (let i = 0; i < n; i++) {
      strip.push({ panel: reel[i], key: `${c}-${i}` })
    }
  }

  // 中央（停止ライン）に現在ある reel index（ハイライト用）
  const centeredIndex = n > 0 ? ((Math.round(offset / PANEL_H + 1) % n) + n) % n : 0

  return (
    <div
      className={`reel-viewport${spinning ? ' is-spinning' : ''}`}
      style={{ height: VISIBLE * PANEL_H }}
    >
      <div className="reel-stopline" aria-hidden />
      <div
        className="reel-strip"
        style={{ transform: `translateY(${-offset}px)` }}
      >
        {strip.map(({ panel, key }, idx) => {
          const isCentered = !spinning && idx % n === centeredIndex
          return (
            <div
              key={key}
              className={`reel-panel cat-${panel.category}${isCentered ? ' centered' : ''}`}
              style={{ height: PANEL_H }}
            >
              <span className="panel-stars" data-star={panel.star}>
                {panel.category === 'miss' ? '—' : stars(panel.star)}
              </span>
              <span className="panel-skill">{panel.skill}</span>
              <span className="panel-cat">{categoryLabel(panel.category)}</span>
              {panel.isNew && <span className="panel-new">NEW</span>}
              <i className="panel-bar" style={{ background: categoryColor(panel.category) }} />
            </div>
          )
        })}
      </div>
    </div>
  )
})
