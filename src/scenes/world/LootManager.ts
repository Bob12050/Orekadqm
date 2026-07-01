// ドロップの落下演出と拾得。落ちたアイテムは近づくと自動で吸い寄せて回収する。

import Phaser from 'phaser'
import type { Session } from '../../state/Session.ts'
import { bus } from '../../core/EventBus.ts'

interface Pickup {
  icon: Phaser.GameObjects.Image
  itemId: string
  count: number
  special: boolean
  collected: boolean
}

export class LootManager {
  private readonly pickups: Pickup[] = []

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: Session,
  ) {}

  drop(x: number, y: number, itemId: string, count: number, special: boolean): void {
    const key = this.scene.textures.exists(`icon_${itemId}`) ? `icon_${itemId}` : 'icon_mat_iron_shard'
    const icon = this.scene.add.image(x, y, key).setDepth(y).setScale(0.7)
    const jump = 14 + Math.random() * 8
    const tx = x + (Math.random() * 24 - 12)
    this.scene.tweens.add({
      targets: icon,
      x: tx,
      y: y - jump,
      duration: 220,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => icon.setY(y),
    })
    if (special) {
      this.scene.tweens.add({ targets: icon, scale: 0.85, duration: 500, yoyo: true, repeat: -1 })
      icon.setTint(0xffffff)
    }
    this.pickups.push({ icon, itemId, count, special, collected: false })
  }

  /** プレイヤー座標に応じて回収する。 */
  update(px: number, py: number): void {
    for (const p of this.pickups) {
      if (p.collected) continue
      const dist = Math.hypot(p.icon.x - px, p.icon.y - py)
      if (dist < 46) {
        // 吸い寄せ
        p.icon.x += (px - p.icon.x) * 0.25
        p.icon.y += (py - p.icon.y) * 0.25
        p.icon.setDepth(p.icon.y)
      }
      if (dist < 12) {
        p.collected = true
        this.session.collectLoot(p.itemId, p.count)
        bus.emit('sfx:play', { id: 'drop_get' })
        this.scene.tweens.add({
          targets: p.icon,
          y: p.icon.y - 16,
          alpha: 0,
          duration: 180,
          onComplete: () => p.icon.destroy(),
        })
      }
    }
  }

  clear(): void {
    for (const p of this.pickups) p.icon.destroy()
    this.pickups.length = 0
  }
}
