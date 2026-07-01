// 仮想スティック。画面左半分のタッチで操作し、右側のボタンとは別ポインタで同時動作する
// （マルチタッチ必須: game config の input.activePointers を 4 以上に）。

import Phaser from 'phaser'
import { input } from '../state/input.ts'

const RADIUS = 46

export class VirtualJoystick {
  private base: Phaser.GameObjects.Image
  private knob: Phaser.GameObjects.Image
  private pointerId = -1
  private baseX: number
  private baseY: number

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.baseX = x
    this.baseY = y
    this.origX = x
    this.origY = y
    this.base = scene.add.image(x, y, 'ui_stick_base').setScrollFactor(0).setDepth(500).setAlpha(0.5)
    this.knob = scene.add.image(x, y, 'ui_stick_knob').setScrollFactor(0).setDepth(501).setAlpha(0.8)

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this)
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this)
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this)
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this)
  }

  private inZone(p: Phaser.Input.Pointer): boolean {
    return p.x < this.base.scene.scale.width * 0.55 && p.y > this.base.scene.scale.height * 0.4
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== -1 || !this.inZone(p)) return
    this.pointerId = p.id
    // 押した場所を基点にする（動的スティック）
    this.baseX = p.x
    this.baseY = p.y
    this.base.setPosition(p.x, p.y).setAlpha(0.7)
    this.knob.setPosition(p.x, p.y).setAlpha(1)
    this.update(p)
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return
    this.update(p)
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return
    this.pointerId = -1
    input.moveX = 0
    input.moveY = 0
    this.base.setPosition(this.origX, this.origY).setAlpha(0.5)
    this.knob.setPosition(this.origX, this.origY).setAlpha(0.8)
  }

  private origX = 0
  private origY = 0

  setHome(x: number, y: number): void {
    this.origX = x
    this.origY = y
    this.base.setPosition(x, y)
    this.knob.setPosition(x, y)
  }

  private update(p: Phaser.Input.Pointer): void {
    let dx = p.x - this.baseX
    let dy = p.y - this.baseY
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    this.knob.setPosition(this.baseX + dx, this.baseY + dy)
    input.moveX = dx / RADIUS
    input.moveY = dy / RADIUS
  }
}
