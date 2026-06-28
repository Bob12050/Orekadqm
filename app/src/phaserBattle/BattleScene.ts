// Phaser バトル PoC。既存の純TSエンジン(Battle)をそのまま使い、描画/演出だけ Phaser で行う。
// モンスターはプログラム生成の「ぷにっとブロブ」(後で本番スプライトに差し替え可能)。
import Phaser from 'phaser'
import type { Battle } from '../battle/engine'
import type { BattleEvent, BattleUnit } from '../battle/types'

const FAMILY_COLOR: Record<string, number> = {
  beast: 0xff7043, dragon: 0xef5350, magic: 0xab47bc, plant: 0x9ccc65, material: 0x8d99ae,
  aqua: 0x42a5f5, bird: 0x4dd0e1, demon: 0xc2185b, spirit: 0xfff176, machine: 0x26c6da,
}
const W = 390

export interface SceneOpts {
  battle: Battle
  onEnd: (outcome: 'win' | 'lose') => void
}

class UnitView {
  container: Phaser.GameObjects.Container
  private body: Phaser.GameObjects.Graphics
  private hpBar: Phaser.GameObjects.Graphics
  private nameText: Phaser.GameObjects.Text
  private ring: Phaser.GameObjects.Graphics
  private scene: BattleScene
  homeX: number
  homeY: number
  radius: number

  constructor(scene: BattleScene, public unit: BattleUnit, x: number, y: number) {
    this.scene = scene
    this.homeX = x
    this.homeY = y
    this.radius = unit.side === 'enemy' && unit.gimmicks?.includes('phases') ? 34 : 26
    this.ring = scene.add.graphics()
    this.body = scene.add.graphics()
    this.hpBar = scene.add.graphics()
    this.nameText = scene.add.text(0, -this.radius - 16, unit.name, { fontSize: '11px', color: '#eef1ff', fontStyle: 'bold' }).setOrigin(0.5)
    this.container = scene.add.container(x, y, [this.ring, this.body, this.hpBar, this.nameText])
    this.container.setSize(this.radius * 2 + 10, this.radius * 2 + 30)
    this.draw()
    // アイドルのふわふわ
    scene.tweens.add({ targets: this.container, y: y - 4, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    if (unit.side === 'enemy') {
      this.container.setInteractive(new Phaser.Geom.Circle(0, 0, this.radius + 8), Phaser.Geom.Circle.Contains)
      this.container.on('pointerdown', () => scene.onTapEnemy(this))
    }
  }

  private draw() {
    const u = this.unit
    const col = FAMILY_COLOR[u.family] ?? 0x888888
    const r = this.radius
    this.body.clear()
    // 体(丸)
    this.body.fillStyle(col, 1).fillCircle(0, 0, r)
    this.body.lineStyle(3, 0x000000, 0.15).strokeCircle(0, 0, r)
    // 目
    this.body.fillStyle(0xffffff, 1).fillCircle(-r * 0.35, -r * 0.15, r * 0.26).fillCircle(r * 0.35, -r * 0.15, r * 0.26)
    this.body.fillStyle(0x1b2240, 1).fillCircle(-r * 0.32, -r * 0.12, r * 0.13).fillCircle(r * 0.38, -r * 0.12, r * 0.13)
    // ほっぺ
    this.body.fillStyle(0xff8aa0, 0.5).fillCircle(-r * 0.55, r * 0.25, r * 0.16).fillCircle(r * 0.55, r * 0.25, r * 0.16)
    this.drawHp()
  }

  drawHp() {
    const r = this.radius
    const w = r * 2
    const ratio = Math.max(0, this.unit.hp / this.unit.maxHp)
    const col = ratio > 0.5 ? 0x66bb6a : ratio > 0.2 ? 0xffca28 : 0xff5252
    this.hpBar.clear()
    this.hpBar.fillStyle(0x0c1024, 1).fillRoundedRect(-w / 2, r + 4, w, 6, 3)
    this.hpBar.fillStyle(col, 1).fillRoundedRect(-w / 2, r + 4, w * ratio, 6, 3)
  }

  setTargeted(on: boolean) {
    this.ring.clear()
    if (on) this.ring.lineStyle(3, 0xff8a65, 1).strokeCircle(0, 0, this.radius + 7)
  }

  faint() {
    this.scene.tweens.add({ targets: this.container, alpha: 0.15, angle: 90, y: this.homeY + 18, duration: 350, ease: 'Quad.in' })
  }
}

export class BattleScene extends Phaser.Scene {
  private opts!: SceneOpts
  private b!: Battle
  private views = new Map<string, UnitView>()
  private targetUid: string | null = null
  private busy = false
  private spinBtn!: Phaser.GameObjects.Container
  private reelCells: { c: Phaser.GameObjects.Container; t: Phaser.GameObjects.Text }[] = []
  private hint!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text

  constructor(opts: SceneOpts) {
    super('Battle')
    this.opts = opts
    this.b = opts.battle
  }

  create() {
    this.cameras.main.setBackgroundColor('#0e1230')
    // 敵(上)・味方(下)を配置
    this.layoutSide('enemy', 110)
    this.layoutSide('ally', 380)

    this.hint = this.add.text(W / 2, 300, '', { fontSize: '12px', color: '#ffcc80' }).setOrigin(0.5)
    this.banner = this.add.text(W / 2, 250, '', { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0)

    // 3セルの縦リール窓（中央が停止ライン）
    this.makeReelCells()
    // SPIN ボタン
    this.spinBtn = this.makeButton(W / 2, 590, '🎰 スピン', 0xffb300, () => this.onSpin())

    this.loop()
  }

  private makeReelCells() {
    const cy = [438, 474, 510]
    cy.forEach((y, i) => {
      const center = i === 1
      const g = this.add.graphics()
      g.fillStyle(center ? 0x222c55 : 0x161c3a, 1).fillRoundedRect(-68, -17, 136, 34, 8)
      if (center) g.lineStyle(2, 0xffd54f, 1).strokeRoundedRect(-68, -17, 136, 34, 8)
      const t = this.add.text(0, 0, '', { fontSize: center ? '15px' : '13px', color: '#ffe082', fontStyle: 'bold' }).setOrigin(0.5)
      const c = this.add.container(W / 2, y, [g, t]).setAlpha(center ? 1 : 0.55)
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
        if (t <= total) {
          this.time.delayedCall(35 + t * 7, step) // だんだん減速
        } else {
          this.setReelLabels(actor, idx)
          this.tweens.add({ targets: this.reelCells[1].c, scaleX: 1.12, scaleY: 0.9, duration: 80, yoyo: true })
          this.time.delayedCall(140, () => res())
        }
      }
      step()
    })
  }

  private layoutSide(side: 'ally' | 'enemy', y: number) {
    const units = this.b.side(side)
    const n = Math.max(units.length, 1)
    units.forEach((u, i) => {
      const x = (W / (n + 1)) * (i + 1)
      this.views.set(u.uid, new UnitView(this, u, x, y))
    })
  }

  private makeButton(x: number, y: number, label: string, color: number, onClick: () => void) {
    const g = this.add.graphics()
    g.fillStyle(color, 1).fillRoundedRect(-80, -22, 160, 44, 12)
    const t = this.add.text(0, 0, label, { fontSize: '18px', color: '#1b2240', fontStyle: 'bold' }).setOrigin(0.5)
    const c = this.add.container(x, y, [g, t]).setSize(160, 44).setInteractive()
    c.on('pointerdown', onClick)
    return c
  }

  onTapEnemy(view: UnitView) {
    if (this.busy || !view.unit.alive) return
    this.targetUid = this.targetUid === view.unit.uid ? null : view.unit.uid
    for (const v of this.views.values()) v.setTargeted(v.unit.uid === this.targetUid && v.unit.side === 'enemy')
  }

  private async loop() {
    if (this.b.outcome !== 'ongoing') {
      this.showResult()
      return
    }
    const cur = this.b.current
    if (!cur) return
    if (cur.side === 'enemy') {
      this.spinBtn.setVisible(false)
      this.hint.setText('敵の番…')
      this.time.delayedCall(450, async () => {
        await this.playEvents(this.b.takeEnemyTurn())
        this.loop()
      })
    } else {
      this.spinBtn.setVisible(true)
      this.hint.setText(this.targetUid ? `🎯 ${this.b.get(this.targetUid)?.name}` : 'タップで敵を指定 / スピン')
      this.setReelLabels(cur, 0)
    }
  }

  private async onSpin() {
    if (this.busy || this.b.outcome !== 'ongoing' || !this.b.isAllyTurn()) return
    this.busy = true
    this.spinBtn.setVisible(false)
    const actor = this.b.current!
    const idx = this.b.autoPanelIndex()
    await this.spinReel(actor, idx)
    const tgt = this.targetUid && this.b.get(this.targetUid)?.alive ? this.targetUid : null
    await this.playEvents(this.b.takeAllyTurn(idx, tgt))
    this.busy = false
    this.loop()
  }

  // ---- イベント再生(演出) ----
  private async playEvents(events: BattleEvent[]) {
    for (const e of events) {
      const v = 'uid' in e ? this.views.get((e as { uid: string }).uid) : undefined
      const tv = 'target' in e ? this.views.get((e as { target: string }).target) : undefined
      switch (e.t) {
        case 'action':
          if (v && e.targets[0]) await this.lunge(v, this.views.get(e.targets[0]))
          break
        case 'damage': {
          if (tv) {
            this.hitFlash(tv, e.crit || e.berserk)
            this.cameras.main.shake(e.crit ? 220 : 120, e.crit ? 0.012 : 0.006)
            tv.drawHp()
            this.popText(tv, `${e.amount}`, e.effectiveness === 'weak' ? '#ff5252' : '#ffffff', e.crit || e.effectiveness === 'weak')
          }
          await this.wait(180)
          break
        }
        case 'heal':
          if (tv) { tv.drawHp(); this.popText(tv, `+${e.amount}`, '#7CFC9A', false) }
          await this.wait(160)
          break
        case 'miss':
          if (tv ?? v) this.popText((tv ?? v)!, 'MISS', '#9aa3bf', false)
          await this.wait(140)
          break
        case 'faint':
          if (v) v.faint()
          await this.wait(220)
          break
        case 'phaseChange':
        case 'attributeShift':
        case 'summon':
          await this.showBanner(e.text)
          break
        case 'outcome':
          break
        default:
          break
      }
    }
  }

  private async lunge(attacker: UnitView, target?: UnitView) {
    if (!target) return
    const dx = (target.homeX - attacker.homeX) * 0.5
    const dy = (target.homeY - attacker.homeY) * 0.5
    await this.tweenPromise({ targets: attacker.container, x: attacker.homeX + dx, y: attacker.homeY + dy, duration: 130, ease: 'Quad.in' })
    this.tweens.add({ targets: attacker.container, x: attacker.homeX, y: attacker.homeY, duration: 200, ease: 'Back.out' })
  }

  private hitFlash(target: UnitView, big: boolean) {
    const f = this.add.graphics()
    f.fillStyle(0xffffff, big ? 0.9 : 0.6).fillCircle(target.homeX, target.homeY, target.radius + (big ? 10 : 4))
    this.tweens.add({ targets: f, alpha: 0, duration: 200, onComplete: () => f.destroy() })
    this.tweens.add({ targets: target.container, scaleX: 1.18, scaleY: 0.85, duration: 70, yoyo: true })
  }

  private popText(target: UnitView, text: string, color: string, big: boolean) {
    const t = this.add.text(target.homeX, target.homeY - target.radius, text, {
      fontSize: big ? '26px' : '18px', color, fontStyle: 'bold',
    }).setOrigin(0.5)
    this.tweens.add({ targets: t, y: target.homeY - target.radius - 36, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: () => t.destroy() })
  }

  private async showBanner(text: string) {
    this.banner.setText(text).setAlpha(1).setScale(0.7)
    await this.tweenPromise({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.out' })
    await this.wait(500)
    await this.tweenPromise({ targets: this.banner, alpha: 0, duration: 200 })
  }

  private showResult() {
    const win = this.b.outcome === 'win'
    this.spinBtn.setVisible(false)
    this.hint.setText('')
    const t = this.add.text(W / 2, 300, win ? '🏆 WIN！' : '💀 LOSE…', {
      fontSize: '40px', color: win ? '#ffd54f' : '#ff6b6b', fontStyle: 'bold',
    }).setOrigin(0.5).setScale(0)
    this.tweens.add({ targets: t, scale: 1, duration: 400, ease: 'Back.out' })
    this.opts.onEnd(win ? 'win' : 'lose')
  }

  // ---- helpers ----
  private wait(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, () => res()))
  }
  private tweenPromise(cfg: Record<string, unknown>) {
    return new Promise<void>((res) => {
      this.tweens.add({ ...cfg, onComplete: () => res() } as unknown as Phaser.Types.Tweens.TweenBuilderConfig)
    })
  }
}
