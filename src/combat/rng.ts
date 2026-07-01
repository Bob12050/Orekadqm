// seedable RNG。ドロップ・演出の再現性のために Math.random は使わない。
// mulberry32: 高速・十分な分布・32bit seed。

export class Rng {
  private state: number

  constructor(seed: number) {
    // 0 seed を避けつつ 32bit に収める
    this.state = (seed >>> 0) || 0x9e3779b9
  }

  /** [0,1) の一様乱数。 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** [min,max] の整数。 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** 0..1 の確率で true。 */
  chance(p: number): boolean {
    return this.next() < p
  }

  /** 配列から1つ選ぶ。空配列では null。 */
  pick<T>(arr: readonly T[]): T | null {
    if (arr.length === 0) return null
    return arr[Math.floor(this.next() * arr.length)] ?? null
  }
}

/** 文字列から安定した 32bit seed を作る（xfnv-1a）。 */
export function seedFromString(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
