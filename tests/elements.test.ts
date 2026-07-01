import { describe, expect, it } from 'vitest'
import { elementMultiplier, rollAilment } from '../src/combat/elements.ts'

describe('elementMultiplier', () => {
  it('弱点は 1.5、耐性は 0.5、それ以外は 1', () => {
    expect(elementMultiplier('fire', { weakness: 'fire' })).toBe(1.5)
    expect(elementMultiplier('fire', { resist: 'fire' })).toBe(0.5)
    expect(elementMultiplier('fire', {})).toBe(1)
    expect(elementMultiplier('none', { weakness: 'fire' })).toBe(1)
  })
})

describe('rollAilment', () => {
  it('無属性では状態異常が起きない', () => {
    expect(rollAilment('none', {}, 0)).toBeNull()
  })

  it('火属性は低ロールで火傷、高ロールで無し', () => {
    expect(rollAilment('fire', {}, 0.0)).toBe('burn')
    expect(rollAilment('fire', {}, 0.99)).toBeNull()
  })

  it('弱点時は発生率が上がる（基本28%→42%）', () => {
    // 0.35 は基本(0.28)では外れ、弱点(0.42)では当たる
    expect(rollAilment('ice', {}, 0.35)).toBeNull()
    expect(rollAilment('ice', { weakness: 'ice' }, 0.35)).toBe('freeze')
  })
})
