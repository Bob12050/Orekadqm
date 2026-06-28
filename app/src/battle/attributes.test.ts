import { describe, expect, it } from 'vitest'
import { elementResult } from './attributes'

describe('elementResult', () => {
  it('weakness loop: fire>wind>earth>water>fire', () => {
    expect(elementResult('fire', 'wind').effectiveness).toBe('weak')
    expect(elementResult('wind', 'earth').effectiveness).toBe('weak')
    expect(elementResult('earth', 'water').effectiveness).toBe('weak')
    expect(elementResult('water', 'fire').effectiveness).toBe('weak')
  })

  it('reverse of weakness is resist', () => {
    expect(elementResult('wind', 'fire').effectiveness).toBe('resist')
    expect(elementResult('fire', 'water').effectiveness).toBe('resist')
  })

  it('light and dark are mutually weak (1.5 both ways)', () => {
    expect(elementResult('light', 'dark').multiplier).toBeCloseTo(1.5)
    expect(elementResult('dark', 'light').multiplier).toBeCloseTo(1.5)
  })

  it('none is always neutral', () => {
    expect(elementResult('none', 'fire').multiplier).toBe(1)
    expect(elementResult('fire', 'none').multiplier).toBe(1)
    expect(elementResult('none', 'none').multiplier).toBe(1)
  })

  it('same element is neutral', () => {
    expect(elementResult('fire', 'fire').effectiveness).toBe('neutral')
  })

  it('multipliers are ordered weak > neutral > resist', () => {
    expect(elementResult('fire', 'wind').multiplier).toBeGreaterThan(elementResult('fire', 'fire').multiplier)
    expect(elementResult('fire', 'fire').multiplier).toBeGreaterThan(elementResult('fire', 'water').multiplier)
  })
})
