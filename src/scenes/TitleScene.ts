// タイトル。つづき/新規（職業選択）を選ぶ。新バージョンはここで適用する。

import Phaser from 'phaser'
import { bus } from '../core/EventBus.ts'
import { loadGameData } from '../data/loader.ts'
import type { GameData } from '../data/types.ts'
import { Session } from '../state/Session.ts'
import { loadSave } from '../save/db.ts'
import { ensurePlaceholders } from '../gen/registry.ts'
import { registerCharacterAnims, animKey } from './world/anims.ts'

const FONT = 'DotGothic16, monospace'

const JOBS: { id: string; label: string }[] = [
  { id: 'job_warrior', label: '戦士' },
  { id: 'job_mage', label: '魔法使い' },
  { id: 'job_priest', label: '僧侶' },
  { id: 'job_thief', label: '盗賊' },
  { id: 'job_tamer', label: 'テイマー' },
]

export class TitleScene extends Phaser.Scene {
  private gameData!: GameData
  private picker?: Phaser.GameObjects.Container

  constructor() {
    super('Title')
  }

  create(): void {
    this.gameData = loadGameData()
    ensurePlaceholders(this, this.gameData)
    const W = this.scale.width
    const H = this.scale.height
    this.cameras.main.setBackgroundColor('#160f26')

    // 背景の淡い装飾
    for (let i = 0; i < 5; i++) {
      const key = JOBS[i]?.id ? this.gameData.jobs[JOBS[i]!.id]?.appearance ?? 'char_base' : 'char_base'
      const spr = this.add.sprite(40 + i * 70, H - 120, key, 0).setAlpha(0.14).setScale(1.1)
      registerCharacterAnims(this, key)
      spr.play(animKey(key, 'down', 'idle'))
    }

    this.add
      .text(W / 2, H * 0.24, 'Orekadqm', { fontFamily: FONT, fontSize: '34px', color: '#eadfff' })
      .setOrigin(0.5)
    this.add
      .text(W / 2, H * 0.24 + 32, 'ちいさな狩人の物語', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#a48fd0',
      })
      .setOrigin(0.5)

    // 主人公プレビュー（戦士）
    const hero = this.add.sprite(W / 2, H * 0.5, 'char_warrior', 0).setScale(2)
    registerCharacterAnims(this, 'char_warrior')
    hero.play(animKey('char_warrior', 'down', 'idle'))

    void this.buildMenu(W, H)
  }

  private async buildMenu(W: number, H: number): Promise<void> {
    const save = await loadSave()
    const y0 = H * 0.66
    if (save) {
      this.menuButton(W / 2, y0, 'つづきから', '#ffe8a8', () => {
        const session = new Session(this.gameData, save)
        this.startGame(session)
      })
      this.menuButton(W / 2, y0 + 44, 'さいしょから', '#cbb8f0', () => this.showPicker())
    } else {
      this.menuButton(W / 2, y0, 'はじめる', '#ffe8a8', () => this.showPicker())
    }
  }

  private menuButton(x: number, y: number, label: string, color: string, onClick: () => void): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '18px',
        color,
        backgroundColor: '#241b33',
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    t.on('pointerover', () => t.setColor('#ffffff'))
    t.on('pointerout', () => t.setColor(color))
    t.on('pointerdown', () => {
      bus.emit('sfx:play', { id: 'ui_confirm' })
      onClick()
    })
    return t
  }

  private showPicker(): void {
    if (this.picker) return
    const W = this.scale.width
    const H = this.scale.height
    const c = this.add.container(0, 0).setDepth(1000)
    c.add(this.add.rectangle(0, 0, W, H, 0x120c1f, 0.96).setOrigin(0).setInteractive())
    c.add(this.add.text(W / 2, H * 0.16, 'しょくぎょうを えらぶ', {
      fontFamily: FONT, fontSize: '18px', color: '#eadfff',
    }).setOrigin(0.5))

    JOBS.forEach((job, i) => {
      const y = H * 0.28 + i * 62
      const def = this.gameData.jobs[job.id]
      const key = def?.appearance ?? 'char_base'
      registerCharacterAnims(this, key)
      const spr = this.add.sprite(W / 2 - 96, y + 6, key, 0).setScale(1.1)
      spr.play(animKey(key, 'down', 'idle'))
      c.add(spr)
      const btn = this.add
        .text(W / 2 - 60, y - 10, `${job.label}\n${def?.desc ?? ''}`, {
          fontFamily: FONT, fontSize: '12px', color: '#e8e0f5',
          backgroundColor: '#241b33', padding: { x: 10, y: 6 },
          wordWrap: { width: W * 0.6, useAdvancedWrap: true },
        })
        .setInteractive({ useHandCursor: true })
      btn.on('pointerdown', () => {
        bus.emit('sfx:play', { id: 'ui_confirm' })
        const session = Session.newGame(this.gameData, job.id)
        this.startGame(session)
      })
      c.add(btn)
    })
    this.picker = c
  }

  private startGame(session: Session): void {
    this.scene.start('World', { session, mapId: 'map_town' })
  }
}
