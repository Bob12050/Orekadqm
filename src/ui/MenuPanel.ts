// メニュー（ステータス/そうび/クラフト/クエスト）。
// ジオメトリマスクは使わず、不透明の背景・ヘッダー・フッターで覆う方式（前作の学び）。

import Phaser from 'phaser'
import { bus } from '../core/EventBus.ts'
import { EQUIP_SLOTS, type EquipSlot } from '../data/types.ts'
import type { Session } from '../state/Session.ts'
import { input } from '../state/input.ts'
import { equippableForSlot } from '../stats/equipment.ts'
import { canCraft, craft } from '../crafting/crafting.ts'
import { acceptQuest, getProgress } from '../quests/quests.ts'

const FONT = 'DotGothic16, monospace'
type Tab = 'status' | 'equip' | 'craft' | 'quest'
const TABS: { id: Tab; label: string }[] = [
  { id: 'status', label: 'ステータス' },
  { id: 'equip', label: 'そうび' },
  { id: 'craft', label: 'クラフト' },
  { id: 'quest', label: 'クエスト' },
]

const SLOT_LABEL: Record<EquipSlot, string> = {
  head: 'あたま', body: 'からだ', hands: 'うで', waist: 'こし', feet: 'あし',
  back: 'せなか', weapon: 'ぶき', acc1: 'かざり1', acc2: 'かざり2',
}

export class MenuPanel {
  private root: Phaser.GameObjects.Container
  private content: Phaser.GameObjects.Container
  private tab: Tab = 'status'
  private visible = false
  private readonly W: number
  private readonly H: number

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: Session,
  ) {
    this.W = scene.scale.width
    this.H = scene.scale.height
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(10000).setVisible(false)
    this.content = scene.add.container(0, 0)
    this.build()
    bus.on('loot:collected', () => { if (this.visible) this.render() })
    bus.on('player:leveled', () => { if (this.visible) this.render() })
  }

  private build(): void {
    // 背景（不透明）
    const bg = this.scene.add.rectangle(0, 0, this.W, this.H, 0x14101f, 0.98).setOrigin(0)
    // ヘッダーバー
    const header = this.scene.add.rectangle(0, 0, this.W, 40, 0x241b33).setOrigin(0)
    const title = this.scene.add
      .text(10, 12, 'メニュー', { fontFamily: FONT, fontSize: '16px', color: '#eadfff' })
      .setOrigin(0, 0)
    const close = this.scene.add
      .text(this.W - 34, 8, '✕', { fontFamily: FONT, fontSize: '20px', color: '#ffb0b0' })
      .setInteractive({ useHandCursor: true })
    close.on('pointerdown', () => { bus.emit('sfx:play', { id: 'ui_cancel' }); this.hide() })
    this.root.add([bg, header, title, close])

    // タブ（ヘッダー下）
    const tabW = this.W / TABS.length
    TABS.forEach((t, i) => {
      const x = i * tabW
      const tb = this.scene.add.rectangle(x, 40, tabW, 26, 0x1c1530).setOrigin(0).setInteractive()
      const tl = this.scene.add
        .text(x + tabW / 2, 53, t.label, { fontFamily: FONT, fontSize: '11px', color: '#cbb8f0' })
        .setOrigin(0.5)
      tb.on('pointerdown', () => {
        bus.emit('sfx:play', { id: 'ui_select' })
        this.tab = t.id
        this.render()
      })
      tb.setData('tab', t.id)
      tl.setData('tab', t.id)
      this.root.add([tb, tl])
    })
    this.root.add(this.content)
  }

  private clearContent(): void {
    this.content.removeAll(true)
  }

  private txt(x: number, y: number, s: string, size = 12, color = '#e8e0f5'): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, s, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
      wordWrap: { width: this.W - 24, useAdvancedWrap: true },
    })
    this.content.add(t)
    return t
  }

  private render(): void {
    this.clearContent()
    // タブ強調
    this.root.list.forEach((o) => {
      const data = (o as Phaser.GameObjects.GameObject).getData?.('tab') as Tab | undefined
      if (data && o instanceof Phaser.GameObjects.Rectangle) {
        o.fillColor = data === this.tab ? 0x3a2b55 : 0x1c1530
      }
    })
    if (this.tab === 'status') this.renderStatus()
    else if (this.tab === 'equip') this.renderEquip()
    else if (this.tab === 'craft') this.renderCraft()
    else this.renderQuest()
  }

  private renderStatus(): void {
    const s = this.session
    const d = s.derived
    let y = 78
    this.txt(12, y, `${s.job.name}  Lv.${s.save.player.level}`, 16, '#ffe8a8')
    y += 26
    this.txt(12, y, `HP ${s.hp}/${d.maxHp}   MP ${s.mp}/${d.maxMp}`, 13)
    y += 22
    const rows: [string, number | string][] = [
      ['物理攻撃', d.physAtk], ['魔法攻撃', d.magAtk], ['防御', d.def], ['魔防', d.magDef],
      ['命中', d.accuracy], ['回避', d.evasion], ['会心率', `${Math.round(d.critRate * 100)}%`],
      ['攻撃速度', d.atkSpeed.toFixed(2)], ['移動速度', d.moveSpeed],
    ]
    rows.forEach((r, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      this.txt(12 + col * (this.W / 2 - 6), y + row * 20, `${r[0]}: ${r[1]}`, 12)
    })
    y += Math.ceil(rows.length / 2) * 20 + 8
    const skills = s.save.player.learnedSkills
      .map((id) => s.data.skills[id]?.name ?? id)
      .join('、')
    this.txt(12, y, `おぼえた技: ${skills || 'なし'}`, 11, '#bfb0d8')
  }

  private renderEquip(): void {
    const s = this.session
    let y = 76
    this.txt(12, y, 'スロットを押すと装備を切り替え', 11, '#bfb0d8')
    y += 22
    for (const slot of EQUIP_SLOTS) {
      const cur = s.save.equipped[slot]
      const def = cur ? s.data.equipment[cur] : undefined
      const label = `${SLOT_LABEL[slot]}: ${def?.name ?? '―'}`
      const row = this.scene.add
        .text(12, y, label, { fontFamily: FONT, fontSize: '12px', color: def ? '#e8e0f5' : '#7d6ba8' })
        .setInteractive({ useHandCursor: true })
      row.on('pointerdown', () => this.cycleSlot(slot))
      this.content.add(row)
      y += 22
    }
  }

  private cycleSlot(slot: EquipSlot): void {
    const s = this.session
    const options = equippableForSlot(s.save, s.data, s.job, slot)
    const cur = s.save.equipped[slot]
    // 現在→次の候補→…→未装備 の循環
    const ids = [...options.map((o) => o.id), null]
    const idx = ids.findIndex((id) => id === cur)
    const next = ids[(idx + 1) % ids.length] ?? null
    if (s.equip(slot, next)) {
      bus.emit('sfx:play', { id: 'ui_confirm' })
      this.render()
    } else {
      bus.emit('sfx:play', { id: 'ui_cancel' })
    }
  }

  private renderCraft(): void {
    const s = this.session
    let y = 76
    this.txt(12, y, '素材がそろえば作成/強化できる', 11, '#bfb0d8')
    y += 22
    for (const recipe of Object.values(s.data.recipes)) {
      const out = s.data.equipment[recipe.output]
      const ok = canCraft(s.save, recipe).ok
      const mats = recipe.materials
        .map((m) => `${s.data.items[m.itemId]?.name ?? m.itemId}x${m.count}`)
        .join(' ')
      const label = `${out?.name ?? recipe.output}\n  ${mats}${recipe.upgradeFrom ? ' +強化元' : ''}`
      const row = this.scene.add
        .text(12, y, label, {
          fontFamily: FONT,
          fontSize: '12px',
          color: ok ? '#a8ffb0' : '#8d7fa8',
          wordWrap: { width: this.W - 24, useAdvancedWrap: true },
        })
        .setInteractive({ useHandCursor: true })
      row.on('pointerdown', () => {
        if (craft(s.save, s.data, recipe)) {
          s.recompute()
          bus.emit('sfx:play', { id: 'level_up' })
          bus.emit('toast', { text: `${out?.name ?? '装備'}を作成！` })
          this.render()
        } else {
          bus.emit('sfx:play', { id: 'ui_cancel' })
          bus.emit('toast', { text: '素材がたりない' })
        }
      })
      this.content.add(row)
      y += 40
    }
  }

  private renderQuest(): void {
    const s = this.session
    let y = 76
    for (const quest of Object.values(s.data.quests)) {
      const p = getProgress(s.save, quest.id)
      const star = '★'.repeat(quest.rank)
      let state = '未受注'
      let color = '#cbb8f0'
      if (p?.done) { state = '達成'; color = '#a8ffb0' }
      else if (p?.accepted) { state = `${p.progress}/${quest.count}`; color = '#ffe8a8' }
      const label = `${quest.name} ${star}\n  ${quest.desc}\n  [${state}]`
      const row = this.scene.add
        .text(12, y, label, {
          fontFamily: FONT,
          fontSize: '12px',
          color,
          wordWrap: { width: this.W - 24, useAdvancedWrap: true },
        })
        .setInteractive({ useHandCursor: true })
      row.on('pointerdown', () => {
        if (!p && acceptQuest(s.save, quest.id)) {
          bus.emit('sfx:play', { id: 'ui_confirm' })
          bus.emit('toast', { text: `受注: ${quest.name}` })
          this.render()
        }
      })
      this.content.add(row)
      y += 58
    }
    this.txt(12, y + 4, '狩猟クエストは対象マップへ行き討伐', 11, '#8d7fa8')
  }

  toggle(): void {
    if (this.visible) this.hide()
    else this.show()
  }

  show(): void {
    this.visible = true
    input.paused = true
    this.root.setVisible(true)
    this.render()
  }

  hide(): void {
    this.visible = false
    input.paused = false
    this.root.setVisible(false)
  }

  get isOpen(): boolean {
    return this.visible
  }
}
