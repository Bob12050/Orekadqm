// マップ描画。地面(TileSprite)＋外周の縁＋装飾＋出口ゲート。
// 図形/タイルのみ。物理ワールド境界も設定する。

import Phaser from 'phaser'
import { TILE } from '../../core/constants.ts'
import type { MapDef, MapExit } from '../../data/types.ts'

export interface ExitZone {
  exit: MapExit
  x: number
  y: number
}

function hash(x: number, y: number): number {
  let h = (x * 92837111 + y * 689287499) | 0
  h = (h ^ (h >>> 13)) | 0
  return ((Math.imul(h, 1274126177) ^ (h >>> 16)) >>> 0) / 4294967296
}

export class MapRenderer {
  readonly widthPx: number
  readonly heightPx: number
  readonly exits: ExitZone[] = []

  constructor(
    private readonly scene: Phaser.Scene,
    readonly map: MapDef,
  ) {
    this.widthPx = map.widthTiles * TILE
    this.heightPx = map.heightTiles * TILE

    // 地面
    scene.add
      .tileSprite(0, 0, this.widthPx, this.heightPx, `ground_${map.id}`)
      .setOrigin(0, 0)
      .setDepth(-10000)

    this.drawEdges()
    this.drawDecor()
    this.drawExits()

    scene.physics.world.setBounds(TILE, TILE, this.widthPx - TILE * 2, this.heightPx - TILE * 2)
  }

  private drawEdges(): void {
    const key = `edge_${this.map.id}`
    const w = this.widthPx
    const h = this.heightPx
    const s = this.scene
    s.add.tileSprite(0, 0, w, TILE, key).setOrigin(0, 0).setDepth(-9000)
    s.add.tileSprite(0, h - TILE, w, TILE, key).setOrigin(0, 0).setDepth(h)
    s.add.tileSprite(0, 0, TILE, h, key).setOrigin(0, 0).setDepth(-9000)
    s.add.tileSprite(w - TILE, 0, TILE, h, key).setOrigin(0, 0).setDepth(-9000)
  }

  private drawDecor(): void {
    const s = this.scene
    const kind = this.map.kind
    for (let ty = 2; ty < this.map.heightTiles - 2; ty++) {
      for (let tx = 2; tx < this.map.widthTiles - 2; tx++) {
        const n = hash(tx, ty)
        const cx = tx * TILE + TILE / 2
        const cy = ty * TILE + TILE / 2
        if (kind === 'town') {
          if (n > 0.93 && tx > 3 && tx < this.map.widthTiles - 3) {
            const house = s.add.image(cx, cy, 'deco_house').setOrigin(0.5, 0.9)
            house.setDepth(cy)
          } else if (n > 0.88) {
            s.add.image(cx, cy, 'deco_tree').setOrigin(0.5, 0.95).setDepth(cy)
          }
        } else if (kind === 'field') {
          if (n > 0.9) s.add.image(cx, cy, 'deco_tree').setOrigin(0.5, 0.95).setDepth(cy)
          else if (n > 0.85) s.add.image(cx, cy, 'deco_rock').setOrigin(0.5, 0.9).setDepth(cy)
        } else if (kind === 'arena') {
          if (n > 0.95) s.add.image(cx, cy, 'deco_rock').setOrigin(0.5, 0.9).setDepth(cy)
        }
      }
    }
  }

  private drawExits(): void {
    for (const exit of this.map.exits) {
      const x = exit.tx * TILE + TILE / 2
      const y = exit.ty * TILE + TILE / 2
      const img = this.scene.add.image(x, y, `portal_${this.map.id}`).setOrigin(0.5, 0.7)
      img.setDepth(y - 20)
      this.scene.tweens.add({ targets: img, alpha: 0.7, duration: 900, yoyo: true, repeat: -1 })
      this.scene.add
        .text(x, y - 34, exit.label, {
          fontFamily: 'DotGothic16, monospace',
          fontSize: '10px',
          color: '#fff2e6',
          backgroundColor: '#00000088',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(y)
      this.exits.push({ exit, x, y })
    }
  }

  /** プレイヤーの初期位置（マップ中央やや下）。 */
  playerStart(): { x: number; y: number } {
    return { x: this.widthPx / 2, y: this.heightPx / 2 }
  }

  /** 敵のスポーン位置を count 個返す（中央と縁を避ける）。 */
  spawnPoints(count: number, seed: number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = []
    let i = seed
    let guard = 0
    while (pts.length < count && guard < count * 40) {
      guard++
      i++
      const tx = 3 + Math.floor(hash(i, seed) * (this.map.widthTiles - 6))
      const ty = 3 + Math.floor(hash(seed, i) * (this.map.heightTiles - 6))
      const x = tx * TILE + TILE / 2
      const y = ty * TILE + TILE / 2
      const center = Math.hypot(x - this.widthPx / 2, y - this.heightPx / 2)
      if (center < 70) continue
      pts.push({ x, y })
    }
    return pts
  }
}
