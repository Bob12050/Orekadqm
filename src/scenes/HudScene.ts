// 画面上の操作UIとステータス表示のオーバーレイシーン。
// safe-area を考慮し、操作ボタンをホームインジケーター位置に重ねない。

import Phaser from 'phaser'
import { bus } from '../core/EventBus.ts'
import { input } from '../state/input.ts'
import type { Session } from '../state/Session.ts'
import { expToNext } from '../stats/leveling.ts'
import { VirtualJoystick } from '../ui/VirtualJoystick.ts'
import { MenuPanel } from '../ui/MenuPanel.ts'

const FONT = 'DotGothic16, monospace'
const SAFE_BOTTOM = 26

interface HudInit {
  session: Session
}

export class HudScene extends Phaser.Scene {
  private session!: Session
  private hpBar!: Phaser.GameObjects.Rectangle
  private mpBar!: Phaser.GameObjects.Rectangle
  private expBar!: Phaser.GameObjects.Rectangle
  private lvText!: Phaser.GameObjects.Text
  private toast!: Phaser.GameObjects.Text
  private menu!: MenuPanel
  private readonly unsub: (() => void)[] = []

  constructor() {
    super('Hud')
  }

  init(data: HudInit): void {
    this.session = data.session
  }

  create(): void {
    const W = this.scale.width
    this.buildStatusBars(W)
    this.buildControls(W)
    this.buildToast(W)
    this.menu = new MenuPanel(this, this.session)

    this.unsub.push(
      bus.on('player:hp-changed', ({ hp, maxHp }) => this.setBar(this.hpBar, hp, maxHp, 96)),
      bus.on('player:mp-changed', ({ mp, maxMp }) => this.setBar(this.mpBar, mp, maxMp, 96)),
      bus.on('player:exp-changed', ({ exp, next }) => this.setBar(this.expBar, exp, next, 100)),
      bus.on('player:leveled', ({ level }) => {
        this.lvText.setText(`Lv.${level}`)
        this.setBar(this.expBar, this.session.save.player.exp, expToNext(level), 100)
        this.showToast(`レベルアップ！ Lv.${level}`)
      }),
      bus.on('toast', ({ text }) => this.showToast(text)),
    )

    this.refresh()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const u of this.unsub) u()
      this.unsub.length = 0
    })
  }

  private refresh(): void {
    const s = this.session
    this.setBar(this.hpBar, s.hp, s.derived.maxHp, 96)
    this.setBar(this.mpBar, s.mp, s.derived.maxMp, 96)
    this.setBar(this.expBar, s.save.player.exp, expToNext(s.save.player.level), 100)
    this.lvText.setText(`Lv.${s.save.player.level}`)
  }

  private buildStatusBars(W: number): void {
    this.add.rectangle(0, 0, W, 34, 0x120c1f, 0.8).setOrigin(0)
    this.add.text(8, 4, 'HP', { fontFamily: FONT, fontSize: '10px', color: '#ff9a9a' })
    this.add.rectangle(30, 6, 96, 8, 0x3a1420).setOrigin(0)
    this.hpBar = this.add.rectangle(30, 6, 96, 8, 0xe0563f).setOrigin(0)
    this.add.text(8, 16, 'MP', { fontFamily: FONT, fontSize: '10px', color: '#9ab8ff' })
    this.add.rectangle(30, 18, 96, 6, 0x151f3a).setOrigin(0)
    this.mpBar = this.add.rectangle(30, 18, 96, 6, 0x4c8fe6).setOrigin(0)
    this.lvText = this.add.text(136, 4, 'Lv.1', { fontFamily: FONT, fontSize: '12px', color: '#ffe8a8' })
    this.add.rectangle(136, 22, 100, 5, 0x2a2036).setOrigin(0)
    this.expBar = this.add.rectangle(136, 22, 0, 5, 0x8fd06a).setOrigin(0)

    // SFXトグル
    const sfxBtn = this.add
      .text(W - 76, 8, '♪', { fontFamily: FONT, fontSize: '16px', color: '#cbb8f0' })
      .setInteractive({ useHandCursor: true })
    sfxBtn.on('pointerdown', () => {
      bus.emit('sfx:play', { id: 'ui_select' })
      const on = this.game.registry.get('sfxToggle') as (() => boolean) | undefined
      const state = on ? on() : true
      sfxBtn.setColor(state ? '#cbb8f0' : '#5a4a78')
    })

    // メニューボタン
    const menuBtn = this.add
      .text(W - 40, 6, '≡', { fontFamily: FONT, fontSize: '22px', color: '#eadfff' })
      .setInteractive({ useHandCursor: true })
    menuBtn.on('pointerdown', () => {
      bus.emit('sfx:play', { id: 'ui_select' })
      this.menu.toggle()
    })
  }

  private buildControls(W: number): void {
    const H = this.scale.height
    const stick = new VirtualJoystick(this, 72, H - 90 - SAFE_BOTTOM)
    stick.setHome(72, H - 90 - SAFE_BOTTOM)

    const bx = W - 56
    const by = H - 70 - SAFE_BOTTOM
    this.actionButton(bx, by, 'ui_btn_attack', 1, () => {
      input.attack = true
    })
    this.actionButton(bx - 62, by + 6, 'ui_btn_skill', 0.85, () => {
      input.skill = true
    })
    this.actionButton(bx - 20, by - 60, 'ui_btn_examine', 0.8, () => {
      input.examine = true
    })
  }

  private actionButton(x: number, y: number, key: string, scale: number, onPress: () => void): void {
    const btn = this.add
      .image(x, y, key)
      .setScale(scale)
      .setScrollFactor(0)
      .setDepth(500)
      .setInteractive({ useHandCursor: true })
    btn.on('pointerdown', () => {
      if (input.paused) return
      btn.setScale(scale * 0.9)
      onPress()
    })
    btn.on('pointerup', () => btn.setScale(scale))
    btn.on('pointerout', () => btn.setScale(scale))
  }

  private buildToast(W: number): void {
    this.toast = this.add
      .text(W / 2, 52, '', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#fff2e6',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 3 },
        align: 'center',
        wordWrap: { width: W - 40, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0)
      .setDepth(9000)
      .setAlpha(0)
  }

  private showToast(text: string): void {
    this.toast.setText(text).setAlpha(1)
    this.tweens.killTweensOf(this.toast)
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1400, duration: 500 })
  }

  private setBar(bar: Phaser.GameObjects.Rectangle, value: number, max: number, fullW: number): void {
    const ratio = max > 0 ? Phaser.Math.Clamp(value / max, 0, 1) : 0
    bar.width = fullW * ratio
  }
}
