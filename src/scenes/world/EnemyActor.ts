// 敵の見た目＋簡易AI＋HP。完成済み単一スプライト（レイヤー合成しない）。
// 行動パターンは Phase 1 でデータ駆動化する前提の最小実装（chase / wander / boss）。

import Phaser from 'phaser'
import type { EnemyDef } from '../../data/types.ts'
import type { EnemyElementProfile } from '../../combat/elements.ts'
import { computeEnemyDerived } from '../../stats/stats.ts'

export class EnemyActor {
  readonly phys: Phaser.Physics.Arcade.Image
  readonly sprite: Phaser.GameObjects.Sprite
  hp: number
  readonly maxHp: number
  readonly touchDamage: number
  readonly def: number
  readonly moveSpeed: number
  dead = false
  touchCooldown = 0
  private wanderT = 0
  private wanderVx = 0
  private wanderVy = 0
  private hpbarBg: Phaser.GameObjects.Rectangle
  private hpbarFg: Phaser.GameObjects.Rectangle

  constructor(
    private readonly scene: Phaser.Scene,
    readonly def_: EnemyDef,
    x: number,
    y: number,
  ) {
    const d = computeEnemyDerived(def_.base, def_.level)
    this.maxHp = d.maxHp
    this.hp = d.maxHp
    this.touchDamage = Math.max(1, Math.round(d.physAtk * 0.6))
    this.def = d.def
    this.moveSpeed = def_.isBoss ? 42 : d.moveSpeed * 0.7

    this.phys = scene.physics.add.image(x, y, '__phys').setVisible(false)
    const body = this.phys.body as Phaser.Physics.Arcade.Body
    const r = Math.max(7, def_.visual.size * 0.32)
    body.setCircle(r, -r, -r * 0.5)
    body.setCollideWorldBounds(true)
    body.setBounce(1, 1)

    this.sprite = scene.add.sprite(x, y, `enemy_${def_.visual.sprite}`).setOrigin(0.5, 84 / 96)
    if (def_.isBoss) this.sprite.setScale(1)

    this.hpbarBg = scene.add.rectangle(x, y, 26, 4, 0x000000, 0.6).setDepth(99999).setVisible(false)
    this.hpbarFg = scene.add.rectangle(x, y, 24, 2, 0x66e06a).setDepth(99999).setVisible(false)
  }

  get x(): number {
    return this.phys.x
  }
  get y(): number {
    return this.phys.y
  }

  get elementProfile(): EnemyElementProfile {
    return {
      ...(this.def_.weakness ? { weakness: this.def_.weakness } : {}),
      ...(this.def_.resist ? { resist: this.def_.resist } : {}),
    }
  }

  update(px_: number, py: number, dt: number): void {
    if (this.dead) return
    this.touchCooldown = Math.max(0, this.touchCooldown - dt)
    const dx = px_ - this.phys.x
    const dy = py - this.phys.y
    const dist = Math.hypot(dx, dy)

    let vx = 0
    let vy = 0
    if (this.def_.behavior === 'wander' && dist > 120) {
      this.wanderT -= dt
      if (this.wanderT <= 0) {
        this.wanderT = 600 + Math.random() * 1200
        const a = Math.random() * Math.PI * 2
        this.wanderVx = Math.cos(a)
        this.wanderVy = Math.sin(a)
      }
      vx = this.wanderVx * this.moveSpeed * 0.5
      vy = this.wanderVy * this.moveSpeed * 0.5
    } else if (dist > 6) {
      vx = (dx / dist) * this.moveSpeed
      vy = (dy / dist) * this.moveSpeed
    }
    this.phys.setVelocity(vx, vy)
    if (Math.abs(vx) > 4) this.sprite.setFlipX(vx > 0)

    // 描画は整数スナップ
    this.sprite.x = Math.round(this.phys.x)
    this.sprite.y = Math.round(this.phys.y)
    this.sprite.setDepth(this.sprite.y)
    this.updateHpBar()
  }

  private updateHpBar(): void {
    const show = this.hp < this.maxHp && !this.dead
    this.hpbarBg.setVisible(show)
    this.hpbarFg.setVisible(show)
    if (!show) return
    const top = this.sprite.y - this.def_.visual.size - 10
    this.hpbarBg.setPosition(this.sprite.x, top)
    const ratio = Math.max(0, this.hp / this.maxHp)
    this.hpbarFg.width = 24 * ratio
    this.hpbarFg.setPosition(this.sprite.x - 12 + (24 * ratio) / 2, top)
    this.hpbarFg.fillColor = ratio > 0.5 ? 0x66e06a : ratio > 0.25 ? 0xffce54 : 0xe0563f
  }

  /** ダメージを受ける。倒れたら true。 */
  takeDamage(amount: number): boolean {
    if (this.dead) return false
    this.hp -= amount
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    this.scene.time.delayedCall(80, () => {
      if (!this.dead) this.sprite.clearTint()
    })
    // ノックバック演出
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 0.85,
      scaleY: 1.12,
      duration: 60,
      yoyo: true,
    })
    if (this.hp <= 0) {
      this.die()
      return true
    }
    return false
  }

  private die(): void {
    this.dead = true
    this.phys.setVelocity(0, 0)
    ;(this.phys.body as Phaser.Physics.Arcade.Body).enable = false
    this.hpbarBg.destroy()
    this.hpbarFg.destroy()
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleY: 0.4,
      y: this.sprite.y + 6,
      duration: 220,
      onComplete: () => this.sprite.destroy(),
    })
  }

  destroy(): void {
    this.phys.destroy()
    if (this.sprite.active) this.sprite.destroy()
    this.hpbarBg.destroy()
    this.hpbarFg.destroy()
  }
}
