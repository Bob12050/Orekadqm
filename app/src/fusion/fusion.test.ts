import { describe, expect, it } from 'vitest'
import { previewFusion, executeFusion } from './fusion'
import { createOwned } from '../state/collection'
import { createRng } from '../reel/seededRng'

describe('previewFusion — generic', () => {
  it('applies the family matrix (beast × dragon → dragon)', () => {
    const a = createOwned(1) // モコル(beast)
    const b = createOwned(4) // ファイドラ(dragon)
    expect(previewFusion(a, b).childFamily).toBe('dragon')
  })

  it('same species grants a rank bonus (F + F → above F)', () => {
    const a = createOwned(1) // モコル(beast, F)
    const b = createOwned(1)
    const p = previewFusion(a, b)
    expect(p.rankBonus.sameSpecies).toBe(true)
    expect(p.childRankIndex).toBeGreaterThan(1) // F=index1 より上
  })

  it('caps the rank bonus at the configured maximum', () => {
    const a = createOwned(1, 20) // 同種 + 高Lv
    const b = createOwned(1, 20)
    expect(previewFusion(a, b).rankBonus.total).toBeLessThanOrEqual(2)
  })

  it('always yields at least one candidate and a primary', () => {
    const a = createOwned(6) // ライゼル(dragon B)
    const b = createOwned(15) // メタルゴ(material A)
    const p = previewFusion(a, b)
    expect(p.candidates.length).toBeGreaterThan(0)
    expect(p.primary).toBeTruthy()
  })

  it('lists inheritable skills from both parents, excluding miss', () => {
    const a = createOwned(1) // モコル: ひっかき等
    const b = createOwned(7) // ポフィム: ヒール等
    const skills = previewFusion(a, b).inheritableSkills
    expect(skills).toContain('ひっかき')
    expect(skills).toContain('ヒール')
    expect(skills).not.toContain('ミス')
  })
})

describe('previewFusion — special recipe', () => {
  it('detects the special recipe ファイドラ × ウミナギ → 双極竜(S)', () => {
    const a = createOwned(4) // ファイドラ
    const b = createOwned(18) // ウミナギ
    const p = previewFusion(a, b)
    expect(p.special).not.toBeNull()
    expect(p.childRank).toBe('S')
  })

  it('special recipe is order-independent', () => {
    const p1 = previewFusion(createOwned(4), createOwned(18))
    const p2 = previewFusion(createOwned(18), createOwned(4))
    expect(p1.special?.id).toBe(p2.special?.id)
  })
})

describe('executeFusion', () => {
  it('produces a child one generation above its parents with lineage', () => {
    const a = createOwned(1)
    const b = createOwned(4)
    const { child } = executeFusion(a, b, [], createRng('f1'))
    expect(child.generation).toBe(1)
    expect(child.bornFrom).toEqual([1, 4])
    expect(child.uid).not.toBe(a.uid)
  })

  it('reflects chosen inherited skills in the child reel', () => {
    const a = createOwned(1) // ひっかき を持つ
    const b = createOwned(7)
    const { child } = executeFusion(a, b, ['ひっかき'], createRng('f2'))
    expect(child.reel.some((p) => p.skill === 'ひっかき')).toBe(true)
  })

  it('is deterministic for the same seed and parents', () => {
    const a = createOwned(3)
    const b = createOwned(11)
    const c1 = executeFusion(a, b, [], createRng('same')).child
    const c2 = executeFusion(a, b, [], createRng('same')).child
    expect(c1.speciesId).toBe(c2.speciesId)
    expect(c1.reel.map((p) => p.skill)).toEqual(c2.reel.map((p) => p.skill))
  })

  it('child generation increments from the higher parent generation', () => {
    const a = createOwned(1, 1, {})
    const b = createOwned(4)
    const { child: g1 } = executeFusion(a, b, [], createRng('g'))
    const { child: g2 } = executeFusion(g1, createOwned(10), [], createRng('g2'))
    expect(g2.generation).toBe(2)
  })
})
