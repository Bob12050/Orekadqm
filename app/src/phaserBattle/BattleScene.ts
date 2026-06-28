// Phaser 4 バトル本実装。既存の純TSエンジン(Battle)を駆動し、描画/演出/入力を Phaser で行う。
// 機能: ターゲット指定・スピン(おまかせ)・スカウト(ゲージ/成功率)・状態異常表示・
//       ボスギミック(フェーズ/属性シフト/召喚)・会心/弱点/暴走演出・WIN/LOSE。
import Phaser from 'phaser'
import type { Battle } from '../battle/engine'
import type { BattleEvent, BattleUnit, StatusKind } from '../battle/types'
import { ATTRIBUTE_LABEL } from '../battle/attributes'
import { GAUGE_MAX, scoutStars } from '../battle/scout'

const FAMILY_COLOR: Record<string, number> = {
  beast: 0xff7043, dragon: 0xef5350, magic: 0xab47bc, plant: 0x9ccc65, material: 0x8d99ae,
  aqua: 0x42a5f5, bird: 0x4dd0e1, demon: 0xc2185b, spirit: 0xfff176, machine: 0x26c6da,
}
const STATUS_SHORT: Record<StatusKind, string> = {
  poison: '毒', paralyze: '麻', sleep: '眠', confuse: '混', seal: '封', blind: '暗',
  atkUp: '攻↑', atkDown: '攻↓', defUp: '防↑', defDown: '防↓', haste: '速↑', slow: '速↓',
}
const W = 390

export interface SceneOpts {
  battle: Battle
  onRecruit: (speciesId: number) => void
  onEnd: (outcome: 'win' | 'lose') => void
}

class UnitView {
  container: Phaser.GameObjects.Container
  private body: Phaser.GameObjects.Graphics
  private hpBar: Phaser.GameObjects.Graphics
  private nameText: Phaser.GameObjects.Text
  private statusText: Phaser.GameObjects.Text
  private ring: Phaser.GameObjects.Graphics
  private scene: BattleScene
  homeX: number
  homeY: number
  radius: number

  constructor(scene: BattleScene, public unit: BattleUnit, x: number, y: number) {
    this.scene = scene
    this.homeX = x
    this.homeY = y
    this.radius = unit.gimmicks?.includes('phases') ? 34 : 24
    this.ring = scene.add.graphics()
    this.body = scene.add.graphics()
    this.hpBar = scene.add.graphics()
    const label = (unit.gimmicks?.includes('phases') ? '👑' : '') + unit.name
    this.nameText = scene.add.text(0, -this.radius - 15, label, { fontSize: '11px', color: '#eef1ff', fontStyle: 'bold' }).setOrigin(0.5)
    this.statusText = scene.add.text(0, this.radius + 13, '', { fontSize: '10px', color: '#ffd0d0' }).setOrigin(0.5)
    this.container = scene.add.container(x, y, [this.ring, this.body, this.hpBar, this.nameText, this.statusText])
    this.draw()
    scene.tweens.add({ targets: this.container, y: y - 4, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    if (unit.side === 'enemy') {
      this.container.setInteractive(new Phaser.Geom.Circle(0, 0, this.radius + 10), Phaser.Geom.Circle.Contains)
      this.container.on('pointerdown', () => scene.onTapEnemy(this))
    }
  }

  private draw() {
    const u = this.unit
    const col = FAMILY_COLOR[u.family] ?? 0x888888
    const r = this.radius
    this.body.clear()
    this.body.fillStyle(col, 1).fillCircle(0, 0, r)
    this.body.lineStyle(3, 0x000000, 0.15).strokeCircle(0, 0, r)
    this.body.fillStyle(0xffffff, 1).fillCircle(-r * 0.35, -r * 0.15, r * 0.26).fillCircle(r * 0.35, -r * 0.15, r * 0.26)
    this.body.fillStyle(0x1b2240, 1).fillCircle(-r * 0.32, -r * 0.12, r * 0.13).fillCircle(r * 0.38, -r * 0.12, r * 0.13)
    this.body.fillStyle(0xff8aa0, 0.5).fillCircle(-r * 0.55, r * 0.25, r * 0.16).fillCircle(r * 0.55, r * 0.25, r * 0.16)
    this.refresh()
  }

  refresh() {
    const r = this.radius
    const w = r * 2
    const ratio = Math.max(0, this.unit.hp / this.unit.maxHp)
    const col = ratio > 0.5 ? 0x66bb6a : ratio > 0.2 ? 0xffca28 : 0xff5252
    this.hpBar.clear()
    this.hpBar.fillStyle(0x0c1024, 1).fillRoundedRect(-w / 2, r + 4, w, 5, 3)
    this.hpBar.fillStyle(col, 1).fillRoundedRect(-w / 2, r + 4, w * ratio, 5, 3)
    // 状態異常 + ボスのフェーズ/属性
    const parts: string[] = []
    if (this.unit.gimmicks?.includes('phases')) parts.push(`P${this.unit.phase ?? 1}/${ATTRIBUTE_LABEL[this.unit.attribute]}`)
    for (const s of this.unit.statuses) parts.push(STATUS_SHORT[s.kind])
    this.statusText.setText(parts.join(' '))
  }

  setTargeted(on: boolean) {
    this.ring.clear()
    if (on) this.ring.lineStyle(3, 0xff8a65, 1).strokeCircle(0, 0, this.radius + 8)
  }

  faint() {
    this.scene.tweens.add({ targets: this.container, alpha: 0.12, angle: 90, y: this.homeY + 16, duration: 350, ease: 'Quad.in' })
  }
}

export class BattleScene extends Phaser.Scene {
  private opts!: SceneOpts
  private b!: Battle
  private views = new Map<string, UnitView>()
  private targetUid: string | null = null
  private busy = false
  private auto = false
  private spinBtn!: Phaser.GameObjects.Container
  private scoutBtn!: Phaser.GameObjects.Container
  private autoBtn!: Phaser.GameObjects.Container
  private reelCells: { c: Phaser.GameObjects.Container; t: Phaser.GameObjects.Text }[] = []
  private hint!: Phaser.GameObjects.Text
  private scoutRate!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text
  private gauge!: Phaser.GameObjects.Graphics
  private roundText!: Phaser.GameObjects.Text

  constructor(opts: SceneOpts) {
    super('Battle')
    this.opts = opts
    this.b = opts.battle
  }

  create() {
    this.cameras.main.setBackgroundColor('#0e1230')
    this.roundText = this.add.text(14, 22, '', { fontSize: '12px', color: '#aeb6dd' })
    this.autoBtn = this.makeToggle(W - 52, 28, 'オート', () => {
      this.auto = !this.auto
      this.refreshAutoBtn()
      if (this.auto) this.loop()
    })
    // スカウトゲージ
    this.add.text(14, 44, 'スカウト', { fontSize: '10px', color: '#9aa3c8' })
    this.gauge = this.add.graphics()

    this.layoutSide('enemy', 135)
    this.layoutSide('ally', 350)

    this.hint = this.add.text(W / 2, 250, '', { fontSize: '12px', color: '#ffcc80' }).setOrigin(0.5)
    this.banner = this.add.text(W / 2, 210, '', { fontSize: '19px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0)
    this.scoutRate = this.add.text(W / 2, 520, '', { fontSize: '12px', color: '#aed1ff' }).setOrigin(0.5)

    this.makeReelCells()
    this.spinBtn = this.makeButton(118, 592, '🎰 スピン', 0xffb300, 0x1b2240, () => this.onSpin())
    this.scoutBtn = this.makeButton(280, 592, '🤝 スカウト', 0x5a6ad8, 0xffffff, () => this.onScout())

    this.refresh()
    this.loop()
  }

  // ---- レイアウト/ボタン ----
  private layoutSide(side: 'ally' | 'enemy', y: number) {
    const units = this.b.side(side)
    const n = Math.max(units.length, 1)
    units.forEach((u, i) => {
      const x = (W / (n + 1)) * (i + 1)
      this.views.set(u.uid, new UnitView(this, u, x, y))
    })
  }

  private addMissingEnemyViews() {
    const enemies = this.b.side('enemy')
    const missing = enemies.filter((u) => !this.views.has(u.uid))
    if (missing.length === 0) return
    const n = enemies.length
    missing.forEach((u) => {
      const i = enemies.indexOf(u)
      const x = (W / (n + 1)) * (i + 1)
      const v = new UnitView(this, u, x, 135)
      this.views.set(u.uid, v)
      v.container.setScale(0)
      this.tweens.add({ targets: v.container, scale: 1, duration: 280, ease: 'Back.out' })
    })
  }

  private makeButton(x: number, y: number, label: string, color: number, textColor: number, onClick: () => void) {
    const g = this.add.graphics()
    g.fillStyle(color, 1).fillRoundedRect(-72, -22, 144, 44, 12)
    const t = this.add.text(0, 0, label, { fontSize: '16px', color: Phaser.Display.Color.IntegerToColor(textColor).rgba, fontStyle: 'bold' }).setOrigin(0.5)
    const c = this.add.container(x, y, [g, t]).setSize(144, 44).setInteractive()
    c.on('pointerdown', onClick)
    c.setData('bg', g)
    c.setData('color', color)
    return c
  }

  private makeToggle(x: number, y: number, label: string, onClick: () => void) {
    const g = this.add.graphics()
    const t = this.add.text(0, 0, label, { fontSize: '12px', color: '#b9c2ea', fontStyle: 'bold' }).setOrigin(0.5)
    const c = this.add.container(x, y, [g, t]).setSize(72, 26).setInteractive()
    c.on('pointerdown', onClick)
    c.setData('bg', g)
    c.setData('label', t)
    this.drawToggle(c, false)
    return c
  }
  private drawToggle(c: Phaser.GameObjects.Container, on: boolean) {
    const g = c.getData('bg') as Phaser.GameObjects.Graphics
    g.clear().fillStyle(on ? 0x2a356e : 0x131838, 1).fillRoundedRect(-36, -13, 72, 26, 8)
    g.lineStyle(1, on ? 0x4a5aa8 : 0x2c3566, 1).strokeRoundedRect(-36, -13, 72, 26, 8)
    ;(c.getData('label') as Phaser.GameObjects.Text).setColor(on ? '#ffffff' : '#b9c2ea')
  }
  private refreshAutoBtn() {
    this.drawToggle(this.autoBtn, this.auto)
  }

  private setButtonEnabled(c: Phaser.GameObjects.Container, on: boolean) {
    c.setAlpha(on ? 1 : 0.4)
    if (on) c.setInteractive()
    else c.disableInteractive()
  }

  private makeReelCells() {
    const cy = [430, 466, 502]
    cy.forEach((y, i) => {
      const center = i === 1
      const g = this.add.graphics()
      g.fillStyle(center ? 0x222c55 : 0x161c3a, 1).fillRoundedRect(-92, -17, 184, 34, 8)
      if (center) g.lineStyle(2, 0xffd54f, 1).strokeRoundedRect(-92, -17, 184, 34, 8)
      const t = this.add.text(0, 0, '', { fontSize: center ? '15px' : '13px', color: '#ffe082', fontStyle: 'bold' }).setOrigin(0.5)
      const c = this.add.container(W / 2, y, [g, t]).setAlpha(center ? 1 : 0.5)
      this.reelCells.push({ c, t })
    })
  }
  private setReelLabels(actor: BattleUnit, centerIdx: number) {
    const n = actor.reel.length
    for (let k = -1; k <= 1; k++) {
      const p = actor.reel[((centerIdx + k) % n + n) % n]
      this.reelCells[k + 1].t.setText(p.category === 'miss' ? 'ミス' : `${'★'.repeat(p.star)} ${p.skill}`)
      this.reelCells[k + 1].t.setColor(p.category === 'miss' ? '#99a3bf' : '#ffe082')
    }
  }
  private spinReel(actor: BattleUnit, idx: number) {
    return new Promise<void>((res) => {
      const n = actor.reel.length
      let t = 0
      const total = 16
      const step = () => {
        this.setReelLabels(actor, t % n)
        t++
        if (t <= total) this.time.delayedCall(35 + t * 7, step)
        else {
          this.setReelLabels(actor, idx)
          this.tweens.add({ targets: this.reelCells[1].c, scaleX: 1.1, scaleY: 0.9, duration: 80, yoyo: true })
          this.time.delayedCall(130, () => res())
        }
      }
      step()
    })
  }

  // ---- 状態更新 ----
  private refresh() {
    this.roundText.setText(`ラウンド ${this.b.round}`)
    for (const v of this.views.values()) v.refresh()
    // ゲージ
    const pct = this.b.scoutGauge / GAUGE_MAX
    this.gauge.clear()
    this.gauge.fillStyle(0x0c1024, 1).fillRoundedRect(64, 40, W - 84, 8, 4)
    this.gauge.fillStyle(this.b.gaugeReady ? 0xffca28 : 0xff8a65, 1).fillRoundedRect(64, 40, (W - 84) * pct, 8, 4)
    // スカウト成功率
    if (this.targetUid && this.b.isAllyTurn()) {
      const f = this.b.scoutFactorsFor(this.targetUid)
      if (f && f.scoutable) {
        this.scoutRate.setText(`🤝 ${Math.round(f.chance * 100)}% ${'☆'.repeat(scoutStars(f.chance))}${this.b.gaugeReady ? '' : '（ゲージ満タンで）'}`)
      } else this.scoutRate.setText('')
    } else this.scoutRate.setText('')
    this.setButtonEnabled(this.scoutBtn, !!this.targetUid && this.b.canScout(this.targetUid) && !this.busy)
  }

  onTapEnemy(view: UnitView) {
    if (this.busy || !view.unit.alive) return
    this.targetUid = this.targetUid === view.unit.uid ? null : view.unit.uid
    for (const v of this.views.values()) v.setTargeted(v.unit.uid === this.targetUid && v.unit.side === 'enemy')
    this.refresh()
  }

  // ---- ループ ----
  private loop() {
    this.refresh()
    if (this.b.outcome !== 'ongoing') {
      this.showResult()
      return
    }
    const cur = this.b.current
    if (!cur) return
    if (cur.side === 'enemy') {
      this.spinBtn.setVisible(false)
      this.scoutBtn.setVisible(false)
      this.hint.setText('敵の番…')
      this.time.delayedCall(420, async () => {
        await this.playEvents(this.b.takeEnemyTurn())
        this.loop()
      })
    } else {
      this.spinBtn.setVisible(true)
      this.scoutBtn.setVisible(true)
      this.hint.setText(this.targetUid ? `🎯 ${this.b.get(this.targetUid)?.name}` : 'タップで敵を指定 / スピン')
      this.setReelLabels(cur, 0)
      if (this.auto && !this.busy) this.time.delayedCall(350, () => this.onSpin())
    }
  }

  private async onSpin() {
    if (this.busy || this.b.outcome !== 'ongoing' || !this.b.isAllyTurn()) return
    this.busy = true
    this.spinBtn.setVisible(false)
    this.scoutBtn.setVisible(false)
    const actor = this.b.current!
    const idx = this.b.autoPanelIndex()
    await this.spinReel(actor, idx)
    const tgt = this.targetUid && this.b.get(this.targetUid)?.alive ? this.targetUid : null
    await this.playEvents(this.b.takeAllyTurn(idx, tgt))
    this.busy = false
    this.loop()
  }

  private async onScout() {
    if (this.busy || !this.targetUid || !this.b.canScout(this.targetUid)) return
    this.busy = true
    this.spinBtn.setVisible(false)
    this.scoutBtn.setVisible(false)
    const foe = this.b.get(this.targetUid)
    const speciesId = foe?.speciesId ?? 0
    const ev = this.b.takeAllyScout(this.targetUid)
    const success = ev.some((e) => e.t === 'scoutSuccess')
    await this.playEvents(ev)
    if (success && speciesId) {
      this.opts.onRecruit(speciesId)
      this.targetUid = null
    }
    this.busy = false
    this.loop()
  }

  // ---- イベント再生 ----
  private async playEvents(events: BattleEvent[]) {
    for (const e of events) {
      const v = 'uid' in e ? this.views.get((e as { uid: string }).uid) : undefined
      const tv = 'target' in e ? this.views.get((e as { target: string }).target) : undefined
      switch (e.t) {
        case 'action':
          if (v && e.targets[0]) await this.lunge(v, this.views.get(e.targets[0]))
          break
        case 'damage':
          if (tv) {
            this.hitFlash(tv, e.crit || e.berserk)
            this.cameras.main.shake(e.crit ? 220 : 110, e.crit ? 0.013 : 0.006)
            tv.refresh()
            this.popText(tv, `${e.amount}`, e.effectiveness === 'weak' ? '#ff5252' : '#ffffff', e.crit || e.effectiveness === 'weak')
            if (e.effectiveness === 'weak') this.popMini(tv, '弱点!')
            if (e.crit) this.popMini(tv, '会心!')
          }
          await this.wait(170)
          break
        case 'heal':
          if (tv) { tv.refresh(); this.popText(tv, `+${e.amount}`, '#7CFC9A', false) }
          await this.wait(150)
          break
        case 'drain':
          if (v) v.refresh()
          break
        case 'miss':
          if (tv ?? v) this.popText((tv ?? v)!, 'MISS', '#9aa3bf', false)
          await this.wait(130)
          break
        case 'status':
        case 'buff':
          if (tv) tv.refresh()
          break
        case 'poisonTick':
          if (v) { v.refresh(); this.popText(v, `${e.amount}`, '#b9f0a0', false) }
          await this.wait(120)
          break
        case 'faint':
          if (v) v.faint()
          await this.wait(220)
          break
        case 'scoutAttempt':
          await this.showBanner(e.text)
          break
        case 'scoutSuccess':
          if (tv) { this.sparkle(tv); this.popText(tv, '♥なかま!', '#aed1ff', true); tv.faint() }
          await this.wait(280)
          break
        case 'scoutFail':
          if (tv) { tv.refresh(); this.popText(tv, '失敗 絆+1', '#ffb38a', false) }
          await this.wait(200)
          break
        case 'summon':
          this.addMissingEnemyViews()
          await this.showBanner(e.text)
          break
        case 'phaseChange':
        case 'attributeShift':
          for (const view of this.views.values()) view.refresh()
          await this.showBanner(e.text)
          break
        default:
          break
      }
    }
  }

  // ---- エフェクト ----
  private async lunge(attacker: UnitView, target?: UnitView) {
    if (!target) return
    const dx = (target.homeX - attacker.homeX) * 0.5
    const dy = (target.homeY - attacker.homeY) * 0.5
    await this.tweenPromise({ targets: attacker.container, x: attacker.homeX + dx, y: attacker.homeY + dy, duration: 120, ease: 'Quad.in' })
    this.tweens.add({ targets: attacker.container, x: attacker.homeX, y: attacker.homeY, duration: 200, ease: 'Back.out' })
  }
  private hitFlash(target: UnitView, big: boolean) {
    const f = this.add.graphics()
    f.fillStyle(0xffffff, big ? 0.9 : 0.55).fillCircle(target.homeX, target.homeY, target.radius + (big ? 10 : 4))
    this.tweens.add({ targets: f, alpha: 0, duration: 200, onComplete: () => f.destroy() })
    this.tweens.add({ targets: target.container, scaleX: 1.18, scaleY: 0.84, duration: 70, yoyo: true })
  }
  private sparkle(target: UnitView) {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8
      const s = this.add.text(target.homeX, target.homeY, '✦', { fontSize: '16px', color: '#aed1ff' }).setOrigin(0.5)
      this.tweens.add({ targets: s, x: target.homeX + Math.cos(a) * 40, y: target.homeY + Math.sin(a) * 40, alpha: 0, duration: 500, onComplete: () => s.destroy() })
    }
  }
  private popText(target: UnitView, text: string, color: string, big: boolean) {
    const t = this.add.text(target.homeX, target.homeY - target.radius, text, { fontSize: big ? '26px' : '18px', color, fontStyle: 'bold' }).setOrigin(0.5)
    this.tweens.add({ targets: t, y: target.homeY - target.radius - 36, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: () => t.destroy() })
  }
  private popMini(target: UnitView, text: string) {
    const t = this.add.text(target.homeX + 28, target.homeY - target.radius - 8, text, { fontSize: '12px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0.5)
    this.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 600, onComplete: () => t.destroy() })
  }
  private async showBanner(text: string) {
    this.banner.setText(text).setAlpha(1).setScale(0.7)
    await this.tweenPromise({ targets: this.banner, scale: 1, duration: 180, ease: 'Back.out' })
    await this.wait(450)
    await this.tweenPromise({ targets: this.banner, alpha: 0, duration: 180 })
  }
  private showResult() {
    const win = this.b.outcome === 'win'
    this.spinBtn.setVisible(false)
    this.scoutBtn.setVisible(false)
    this.hint.setText('')
    const t = this.add.text(W / 2, 280, win ? '🏆 WIN！' : '💀 LOSE…', { fontSize: '38px', color: win ? '#ffd54f' : '#ff6b6b', fontStyle: 'bold' }).setOrigin(0.5).setScale(0)
    this.tweens.add({ targets: t, scale: 1, duration: 380, ease: 'Back.out' })
    this.opts.onEnd(win ? 'win' : 'lose')
  }

  private wait(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, () => res()))
  }
  private tweenPromise(cfg: Record<string, unknown>) {
    return new Promise<void>((res) => {
      this.tweens.add({ ...cfg, onComplete: () => res() } as unknown as Phaser.Types.Tweens.TweenBuilderConfig)
    })
  }
}
