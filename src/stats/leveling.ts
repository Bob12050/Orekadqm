// 経験値と成長曲線。純TS。progression テストで想定プレイ時間帯を検証する。

/** 次のレベルに必要な経験値。 */
export function expToNext(level: number): number {
  return Math.floor(18 * Math.pow(level, 1.6)) + 12 * level
}

/** レベル1から目標レベルに到達するのに必要な累積経験値。 */
export function totalExpForLevel(targetLevel: number): number {
  let sum = 0
  for (let l = 1; l < targetLevel; l++) sum += expToNext(l)
  return sum
}

export interface LevelResult {
  level: number
  exp: number
  levelsGained: number
}

/** 経験値を加算し、繰り上がるレベルを解決する。 */
export function gainExp(level: number, exp: number, gained: number, maxLevel = 99): LevelResult {
  let lv = level
  let cur = exp + gained
  let ups = 0
  while (lv < maxLevel && cur >= expToNext(lv)) {
    cur -= expToNext(lv)
    lv++
    ups++
  }
  if (lv >= maxLevel) cur = 0
  return { level: lv, exp: cur, levelsGained: ups }
}
