// プレイヤーの見た目＋物理。物理ボディ（小数座標）と描画スプライト（整数スナップ）を
// 分離し、描画側だけ Math.round する（flipX＋サブピクセルでフレームが欠ける不具合対策）。

import Phaser from 'phaser'
import type { Facing, PoseName } from '../../core/constants.ts'
import { animKey, registerCharacterAnims } from './anims.ts'

export class PlayerActor {
  readonly phys: Phaser.Physics.Arcade.Image
  readonly sprite: Phaser.GameObjects.Sprite
  facing: Facing = 'down'
  private pose: PoseName = 'idle'
  private locked = false
  dead = false

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly charKey: string,
  ) {
    registerCharacterAnims(scene, charKey)
    this.phys = scene.physics.add.image(x, y, '__phys').setVisible(false)
    const body = this.phys.body as Phaser.Physics.Arcade.Body
    body.setCircle(9, -9, -6)
    body.setCollideWorldBounds(true)
    this.sprite = scene.add.sprite(x, y, charKey, 0).setOrigin(0.5, 84 / 96)
    this.playPose('idle')
  }

  get x(): number {
    return this.phys.x
  }
  get y(): number {
    return this.phys.y
  }

  setMoveInput(vx: number, vy: number, speed: number): void {
    if (this.dead || this.locked) {
      this.phys.setVelocity(0, 0)
      return
    }
    const len = Math.hypot(vx, vy)
    if (len < 0.15) {
      this.phys.setVelocity(0, 0)
      this.playPose('idle')
      return
    }
    const nx = vx / len
    const ny = vy / len
    this.phys.setVelocity(nx * speed, ny * speed)
    this.updateFacing(nx, ny)
    this.playPose('walk')
  }

  private updateFacing(nx: number, ny: number): void {
    if (Math.abs(nx) > Math.abs(ny)) {
      this.facing = nx < 0 ? 'left' : 'right'
    } else {
      this.facing = ny < 0 ? 'up' : 'down'
    }
  }

  private playPose(pose: PoseName): void {
    const flip = this.facing === 'right'
    this.sprite.setFlipX(flip)
    if (this.pose === pose && this.sprite.anims.isPlaying) return
    this.pose = pose
    this.sprite.play(animKey(this.charKey, this.facing, pose), true)
  }

  /** 攻撃モーション。命中判定は onHit(facing) を1回だけ呼ぶ。 */
  attack(onHit: (facing: Facing) => void): void {
    if (this.dead || this.locked) return
    this.locked = true
    this.phys.setVelocity(0, 0)
    this.playLocked('attack')
    this.scene.time.delayedCall(110, () => {
      if (!this.dead) onHit(this.facing)
    })
  }

  cast(onCast: () => void): void {
    if (this.dead || this.locked) return
    this.locked = true
    this.phys.setVelocity(0, 0)
    this.playLocked('cast')
    this.scene.time.delayedCall(160, () => {
      if (!this.dead) onCast()
    })
  }

  hurt(): void {
    if (this.dead || this.pose === 'attack') return
    this.locked = true
    this.playLocked('hurt')
    this.sprite.setTint(0xff8080).setTintMode(Phaser.TintModes.FILL)
    this.scene.time.delayedCall(120, () => this.sprite.clearTint())
  }

  die(): void {
    if (this.dead) return
    this.dead = true
    this.locked = true
    this.phys.setVelocity(0, 0)
    this.pose = 'death'
    this.sprite.setFlipX(this.facing === 'right')
    this.sprite.play(animKey(this.charKey, this.facing, 'death'), true)
  }

  private playLocked(pose: PoseName): void {
    this.pose = pose
    this.sprite.setFlipX(this.facing === 'right')
    const key = animKey(this.charKey, this.facing, pose)
    this.sprite.play(key, true)
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.locked = false
      this.playPose('idle')
    })
  }

  /** 毎フレーム: 物理座標を整数化して描画へ反映。 */
  syncSprite(): void {
    this.sprite.x = Math.round(this.phys.x)
    this.sprite.y = Math.round(this.phys.y)
    this.sprite.setDepth(this.sprite.y)
  }

  destroy(): void {
    this.phys.destroy()
    this.sprite.destroy()
  }
}
