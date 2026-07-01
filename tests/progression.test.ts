import { describe, expect, it } from 'vitest'
import { expToNext, gainExp, totalExpForLevel } from '../src/stats/leveling.ts'

describe('成長曲線', () => {
  it('必要EXPはレベルとともに単調増加', () => {
    for (let l = 1; l < 40; l++) {
      expect(expToNext(l + 1)).toBeGreaterThan(expToNext(l))
    }
  })

  it('gainExp は複数レベルを一度に繰り上げる', () => {
    const res = gainExp(1, 0, totalExpForLevel(6))
    expect(res.level).toBe(6)
    expect(res.levelsGained).toBe(5)
    expect(res.exp).toBe(0)
  })

  it('想定プレイ時間が妥当な帯に収まる（序盤の目安）', () => {
    // 平均的な敵EXP ~16、1時間あたり ~450体 と仮定 → 約 7200 EXP/時
    const expPerHour = 16 * 450
    const hoursToLv30 = totalExpForLevel(30) / expPerHour
    // 序盤帯の緩いサニティチェック（前作の学び: 総数一致でなく帯で検証）
    expect(hoursToLv30).toBeGreaterThan(0.2)
    expect(hoursToLv30).toBeLessThan(20)
  })
})
