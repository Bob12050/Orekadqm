// 自作データバリデータ。ID重複・参照切れ・範囲外値・素材入手可能性を検証し、
// 問題があれば非0で終了する（CI/コミット前ゲート）。

import { loadGameData } from '../src/data/loader.ts'
import { isElement } from '../src/combat/elements.ts'
import { EQUIP_SLOTS, WEAPON_TAGS } from '../src/data/types.ts'
import { findSupplyGaps } from '../src/crafting/supply.ts'

const errors: string[] = []
const data = loadGameData()

function err(msg: string): void {
  errors.push(msg)
}

// --- 参照切れ: ドロップ → アイテム/装備 ---
for (const table of Object.values(data.dropTables)) {
  for (const e of table.entries) {
    if (!data.items[e.itemId] && !data.equipment[e.itemId]) {
      err(`dropTable ${table.id}: 未知のアイテム参照 ${e.itemId}`)
    }
    if (e.weight <= 0) err(`dropTable ${table.id}: weight<=0 (${e.itemId})`)
    if (e.min < 0 || e.max < e.min) err(`dropTable ${table.id}: min/max 不正 (${e.itemId})`)
  }
  if (table.guaranteedFirst && !data.items[table.guaranteedFirst] && !data.equipment[table.guaranteedFirst]) {
    err(`dropTable ${table.id}: guaranteedFirst 未知 ${table.guaranteedFirst}`)
  }
}

// --- 装備の範囲/整合 ---
for (const eq of Object.values(data.equipment)) {
  if (!EQUIP_SLOTS.includes(eq.slot)) err(`equipment ${eq.id}: 不正な slot ${eq.slot}`)
  if (eq.rarity < 1 || eq.rarity > 10) err(`equipment ${eq.id}: rarity 範囲外 ${eq.rarity}`)
  if (eq.element && !isElement(eq.element)) err(`equipment ${eq.id}: 不正な element ${eq.element}`)
  if (eq.weaponTag && !WEAPON_TAGS.includes(eq.weaponTag)) {
    err(`equipment ${eq.id}: 不正な weaponTag ${eq.weaponTag}`)
  }
}

// --- 敵の属性/ドロップ参照 ---
for (const en of Object.values(data.enemies)) {
  if (!isElement(en.element)) err(`enemy ${en.id}: 不正な element ${en.element}`)
  if (en.weakness && !isElement(en.weakness)) err(`enemy ${en.id}: 不正な weakness ${en.weakness}`)
  if (en.resist && !isElement(en.resist)) err(`enemy ${en.id}: 不正な resist ${en.resist}`)
  if (!data.dropTables[en.dropTable]) err(`enemy ${en.id}: 未知の dropTable ${en.dropTable}`)
  if (en.level < 1) err(`enemy ${en.id}: level<1`)
}

// --- 職業の武器タグ/見た目 ---
for (const job of Object.values(data.jobs)) {
  if (job.tier < 1 || job.tier > 4) err(`job ${job.id}: tier 範囲外 ${job.tier}`)
  for (const t of job.weaponTags) {
    if (!WEAPON_TAGS.includes(t)) err(`job ${job.id}: 不正な weaponTag ${t}`)
  }
}

// --- スキル: 前提の存在と循環、element ---
for (const sk of Object.values(data.skills)) {
  if (sk.element && !isElement(sk.element)) err(`skill ${sk.id}: 不正な element ${sk.element}`)
  for (const pre of sk.prereq) {
    if (!data.skills[pre]) err(`skill ${sk.id}: 未知の前提 ${pre}`)
  }
}
// 循環検出
for (const sk of Object.values(data.skills)) {
  const seen = new Set<string>()
  const stack: string[] = [sk.id]
  while (stack.length) {
    const cur = stack.pop()!
    if (seen.has(cur)) {
      if (cur === sk.id) err(`skill ${sk.id}: 前提が循環している`)
      continue
    }
    seen.add(cur)
    for (const pre of data.skills[cur]?.prereq ?? []) stack.push(pre)
  }
}

// --- マップ: spawn/exit 参照 ---
for (const map of Object.values(data.maps)) {
  for (const sp of map.spawns) {
    if (!data.enemies[sp.enemy]) err(`map ${map.id}: 未知の spawn 敵 ${sp.enemy}`)
  }
  for (const ex of map.exits) {
    if (!data.maps[ex.toMap]) err(`map ${map.id}: 未知の exit 先 ${ex.toMap}`)
    if (ex.tx < 0 || ex.tx >= map.widthTiles || ex.ty < 0 || ex.ty >= map.heightTiles) {
      err(`map ${map.id}: exit タイル座標が範囲外 (${ex.tx},${ex.ty})`)
    }
  }
}

// --- クエスト: 参照と rank 範囲 ---
for (const q of Object.values(data.quests)) {
  if (q.rank < 1 || q.rank > 7) err(`quest ${q.id}: rank 範囲外 ${q.rank}`)
  if (!data.enemies[q.targetEnemy]) err(`quest ${q.id}: 未知の targetEnemy ${q.targetEnemy}`)
  if (!data.maps[q.map]) err(`quest ${q.id}: 未知の map ${q.map}`)
  for (const r of q.rewardItems) {
    if (!data.items[r.itemId] && !data.equipment[r.itemId]) {
      err(`quest ${q.id}: 未知の報酬 ${r.itemId}`)
    }
  }
}

// --- レシピ: 出力/素材参照 ---
for (const rc of Object.values(data.recipes)) {
  if (!data.equipment[rc.output]) err(`recipe ${rc.id}: 未知の output ${rc.output}`)
  if (rc.upgradeFrom && !data.equipment[rc.upgradeFrom]) {
    err(`recipe ${rc.id}: 未知の upgradeFrom ${rc.upgradeFrom}`)
  }
  for (const m of rc.materials) {
    if (!data.items[m.itemId] && !data.equipment[m.itemId]) {
      err(`recipe ${rc.id}: 未知の素材 ${m.itemId}`)
    }
    if (m.count <= 0) err(`recipe ${rc.id}: count<=0 (${m.itemId})`)
  }
}

// --- 素材入手可能性 ---
for (const gap of findSupplyGaps(data)) {
  err(`recipe ${gap.recipeId}: 素材 ${gap.missing} が入手不能（ドロップ/他レシピに存在しない）`)
}

const counts = {
  items: Object.keys(data.items).length,
  equipment: Object.keys(data.equipment).length,
  jobs: Object.keys(data.jobs).length,
  skills: Object.keys(data.skills).length,
  enemies: Object.keys(data.enemies).length,
  dropTables: Object.keys(data.dropTables).length,
  maps: Object.keys(data.maps).length,
  recipes: Object.keys(data.recipes).length,
  quests: Object.keys(data.quests).length,
}

if (errors.length > 0) {
  console.error(`✗ データ検証エラー ${errors.length} 件:`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('✓ データ検証OK', JSON.stringify(counts))
