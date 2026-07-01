// プロシージャル・プレースホルダーの登録。
// Boot が実PNGを先に読み込み、ここでは「まだ存在しないキーだけ」を生成して埋める
// （PNGを public/assets に置くだけで自動上書きされる方式）。

import Phaser from 'phaser'
import { ATLAS_COLS, ATLAS_ROWS, CHAR_FRAME } from '../core/constants.ts'
import type { GameData } from '../data/types.ts'
import { makeCanvas } from './pixel.ts'
import { buildCharacterAtlas, CHARACTER_KEYS } from './character.ts'
import { buildEnemySprite } from './enemies.ts'
import {
  buildEdgeTexture,
  buildGroundTexture,
  buildHouse,
  buildPortal,
  buildRock,
  buildTree,
} from './tiles.ts'
import {
  buildAttackButton,
  buildEquipIcon,
  buildExamineButton,
  buildItemIcon,
  buildSkillButton,
  buildStickBase,
  buildStickKnob,
} from './ui.ts'

/** 96×96 グリッドの canvas をスプライトシート化して登録（frameIndex = row*4+col）。 */
function addAtlas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) return
  const tex = scene.textures.addCanvas(key, canvas)
  if (!tex) return
  let i = 0
  for (let row = 0; row < ATLAS_ROWS; row++) {
    for (let col = 0; col < ATLAS_COLS; col++) {
      tex.add(i, 0, col * CHAR_FRAME, row * CHAR_FRAME, CHAR_FRAME, CHAR_FRAME)
      i++
    }
  }
}

function addSimple(scene: Phaser.Scene, key: string, make: () => HTMLCanvasElement): void {
  if (scene.textures.exists(key)) return
  scene.textures.addCanvas(key, make())
}

/** シーンに必要なプレースホルダーを全部揃える。 */
export function ensurePlaceholders(scene: Phaser.Scene, data: GameData): void {
  // 物理ボディ用の透明テクスチャ（描画スプライトと分離するため）
  if (!scene.textures.exists('__phys')) {
    scene.textures.addCanvas('__phys', makeCanvas(6, 6))
  }

  // キャラ職業アトラス
  for (const key of CHARACTER_KEYS) {
    addAtlas(scene, key, buildCharacterAtlas(key))
  }

  // 敵スプライト（sprite キーで重複排除）
  const seenEnemy = new Set<string>()
  for (const enemy of Object.values(data.enemies)) {
    const key = `enemy_${enemy.visual.sprite}`
    if (seenEnemy.has(key)) continue
    seenEnemy.add(key)
    addSimple(scene, key, () => buildEnemySprite(enemy.visual))
  }

  // 地面・縁・出口（マップのパレット別）
  for (const map of Object.values(data.maps)) {
    addSimple(scene, `ground_${map.id}`, () => buildGroundTexture(map.palette))
    addSimple(scene, `edge_${map.id}`, () => buildEdgeTexture(map.palette))
    addSimple(scene, `portal_${map.id}`, () => buildPortal(map.palette.accent))
  }

  // 装飾
  addSimple(scene, 'deco_tree', buildTree)
  addSimple(scene, 'deco_rock', buildRock)
  addSimple(scene, 'deco_house', buildHouse)

  // 操作UI
  addSimple(scene, 'ui_stick_base', buildStickBase)
  addSimple(scene, 'ui_stick_knob', buildStickKnob)
  addSimple(scene, 'ui_btn_attack', buildAttackButton)
  addSimple(scene, 'ui_btn_skill', buildSkillButton)
  addSimple(scene, 'ui_btn_examine', buildExamineButton)

  // アイテム/装備アイコン
  for (const item of Object.values(data.items)) {
    const color = item.kind === 'consumable' ? '#e0563f' : item.kind === 'key' ? '#ffd25a' : '#66d9ff'
    addSimple(scene, `icon_${item.id}`, () => buildItemIcon(item.kind, color, item.rarity))
  }
  for (const eq of Object.values(data.equipment)) {
    addSimple(scene, `icon_${eq.id}`, () => buildEquipIcon(eq.slot, colorFor(eq.rarity), eq.rarity))
  }
}

// 循環 import を避けるためローカルにレア度色を持つ（ui.ts と同義）。
function colorFor(rarity: number): string {
  const map: Record<number, string> = {
    1: '#b7c0cc', 2: '#8fd06a', 3: '#5aa9e6', 4: '#b57ce6', 5: '#e6a54c',
    6: '#e66a6a', 7: '#ffd25a', 8: '#66e6c8', 9: '#ff8fd0', 10: '#ffffff',
  }
  return map[rarity] ?? '#b7c0cc'
}
