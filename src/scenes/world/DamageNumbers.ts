// ダメージ数字のオブジェクトプール。属性色で表示、会心は大きく。

import Phaser from 'phaser'
import { ELEMENT_COLOR, type Element } from '../../combat/elements.ts'

export class DamageNumbers {
  private readonly pool: Phaser.GameObjects.Text[] = []

  constructor(private readonly scene: Phaser.Scene) {}

  private obtain(): Phaser.GameObjects.Text {
    const t = this.pool.pop()
    if (t) {
      t.setActive(true).setVisible(true)
      return t
    }
    return this.scene.add
      .text(0, 0, '', { fontFamily: 'DotGothic16, monospace', fontSize: '14px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(200000)
  }

  show(x: number, y: number, amount: number, element: Element, crit: boolean): void {
    const t = this.obtain()
    const color = Phaser.Display.Color.IntegerToColor(ELEMENT_COLOR[element]).rgba
    t.setText(crit ? `${amount}!` : `${amount}`)
    t.setColor(color)
    t.setFontSize(crit ? 20 : 14)
    t.setStroke('#000000', 3)
    t.setPosition(Math.round(x), Math.round(y))
    t.setScale(crit ? 1.2 : 1)
    t.setAlpha(1)
    this.scene.tweens.add({
      targets: t,
      y: y - (crit ? 34 : 24),
      alpha: 0,
      duration: crit ? 800 : 600,
      ease: 'Quad.easeOut',
      onComplete: () => {
        t.setActive(false).setVisible(false)
        this.pool.push(t)
      },
    })
  }
}
