// シード付き乱数（mulberry32）。同じシード→同じ列。
// 設計書 12-8「乱数はシード付きで再現・テスト・将来の同期に有利」を実装。

export type Rng = () => number

/** 文字列/数値シードから 32bit 整数へ */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

/** mulberry32: 高速・十分な分布の決定論的 RNG */
export function createRng(seed: string | number): Rng {
  let a = hashSeed(seed)
  return function (): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** [0, n) の整数 */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n)
}

/** 配列から1要素 */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[randInt(rng, arr.length)]
}
