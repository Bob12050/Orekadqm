// 実行時のゲーム状態。SaveData（永続）と GameData（定義）を束ね、
// 派生ステータス・EXP・装備・クエスト進行の窓口になる。Phaser 非依存。

import { bus } from '../core/EventBus.ts'
import type { Element } from '../combat/elements.ts'
import type { DerivedStats, EquipmentDef, GameData, JobDef } from '../data/types.ts'
import type { SaveData } from '../save/schema.ts'
import { newSave } from '../save/schema.ts'
import { grantLoot } from '../save/inventory.ts'
import { Rng, seedFromString } from '../combat/rng.ts'
import { acceptQuest, recordKill } from '../quests/quests.ts'
import {
  aggregateBaseStats,
  aggregateDerivedMods,
  computeDerived,
} from '../stats/stats.ts'
import { resolveEquipped, canEquip } from '../stats/equipment.ts'
import { expToNext, gainExp } from '../stats/leveling.ts'

export class Session {
  hp: number
  mp: number
  derived: DerivedStats
  /** 戦闘・ドロップ用の seedable RNG。 */
  readonly rng: Rng

  constructor(
    readonly data: GameData,
    public save: SaveData,
  ) {
    this.rng = new Rng(seedFromString(`${save.player.jobId}:${save.savedAt}`) ^ 0x51ed270b)
    this.derived = this.recompute()
    this.hp = save.player.hp >= 0 ? Math.min(save.player.hp, this.derived.maxHp) : this.derived.maxHp
    this.mp = save.player.mp >= 0 ? Math.min(save.player.mp, this.derived.maxMp) : this.derived.maxMp
  }

  /** 新規ゲームを開始する（初期装備を配る）。 */
  static newGame(data: GameData, jobId: string): Session {
    const save = newSave(jobId)
    const session = new Session(data, save)
    session.grantStarterKit()
    return session
  }

  get job(): JobDef {
    const j = this.data.jobs[this.save.player.jobId]
    if (!j) throw new Error(`未知の職業: ${this.save.player.jobId}`)
    return j
  }

  get equippedDefs(): EquipmentDef[] {
    return resolveEquipped(this.data, this.save.equipped)
  }

  get weaponDef(): EquipmentDef | undefined {
    return this.equippedDefs.find((e) => e.slot === 'weapon')
  }

  /** 攻撃属性（武器属性、無ければ none）。 */
  weaponElement(): Element {
    return this.weaponDef?.element ?? 'none'
  }

  /** 通常攻撃の攻撃力（杖/ワンドは魔法攻撃、それ以外は物理攻撃）。 */
  basicAtk(): number {
    const tag = this.weaponDef?.weaponTag
    const magic = tag === 'staff' || tag === 'wand'
    return magic ? this.derived.magAtk : this.derived.physAtk
  }

  recompute(): DerivedStats {
    const equipment = resolveEquipped(this.data, this.save.equipped)
    const base = aggregateBaseStats({
      job: this.job,
      level: this.save.player.level,
      playerBase: this.save.player.base,
      equipment,
    })
    this.derived = computeDerived(base, this.save.player.level, aggregateDerivedMods(equipment))
    return this.derived
  }

  private grantStarterKit(): void {
    const starters: Record<string, string> = {
      warrior: 'eq_wood_sword',
      mage: 'eq_apprentice_wand',
      priest: 'eq_short_mace',
      thief: 'eq_rusty_dagger',
      tamer: 'eq_worn_whip',
    }
    const weapon = starters[this.job.branch] ?? 'eq_wood_sword'
    for (const id of [weapon, 'eq_cloth_cap', 'eq_cloth_robe', 'eq_leather_boots']) {
      if (this.data.equipment[id]) this.save.ownedEquipment.push(id)
    }
    this.equip('weapon', weapon)
    this.equip('head', 'eq_cloth_cap')
    this.equip('body', 'eq_cloth_robe')
    this.equip('feet', 'eq_leather_boots')
    // 学べる開始スキル
    for (const skill of Object.values(this.data.skills)) {
      if (skill.branch === this.job.branch && skill.reqLevel <= 1 && skill.prereq.length === 0) {
        this.save.player.learnedSkills.push(skill.id)
      }
    }
    this.refillOnRecompute()
  }

  private refillOnRecompute(): void {
    this.recompute()
    this.hp = this.derived.maxHp
    this.mp = this.derived.maxMp
  }

  /** 装備する（可否チェック込み）。成功で true。 */
  equip(slot: string, equipId: string | null): boolean {
    if (equipId) {
      const def = this.data.equipment[equipId]
      if (!def || def.slot !== slot) return false
      if (!canEquip(this.job, def).ok) return false
    }
    this.save.equipped[slot as keyof typeof this.save.equipped] = equipId
    const before = this.derived
    this.recompute()
    // HP/MP を最大値の割合で保つ
    this.hp = Math.min(this.derived.maxHp, Math.round((this.hp / before.maxHp) * this.derived.maxHp))
    this.mp = Math.min(this.derived.maxMp, Math.round((this.mp / before.maxMp) * this.derived.maxMp))
    bus.emit('equipment:changed', { slot, instanceId: equipId })
    bus.emit('player:hp-changed', { hp: this.hp, maxHp: this.derived.maxHp })
    return true
  }

  damage(amount: number): number {
    this.hp = Math.max(0, this.hp - amount)
    bus.emit('player:hp-changed', { hp: this.hp, maxHp: this.derived.maxHp })
    return this.hp
  }

  heal(amount: number): void {
    this.hp = Math.min(this.derived.maxHp, this.hp + amount)
    bus.emit('player:hp-changed', { hp: this.hp, maxHp: this.derived.maxHp })
  }

  spendMp(amount: number): boolean {
    if (this.mp < amount) return false
    this.mp -= amount
    bus.emit('player:mp-changed', { mp: this.mp, maxMp: this.derived.maxMp })
    return true
  }

  restoreMp(amount: number): void {
    this.mp = Math.min(this.derived.maxMp, this.mp + amount)
    bus.emit('player:mp-changed', { mp: this.mp, maxMp: this.derived.maxMp })
  }

  fullRestore(): void {
    this.hp = this.derived.maxHp
    this.mp = this.derived.maxMp
    bus.emit('player:hp-changed', { hp: this.hp, maxHp: this.derived.maxHp })
    bus.emit('player:mp-changed', { mp: this.mp, maxMp: this.derived.maxMp })
  }

  /** 経験値付与。レベルアップを解決し、上がったら全回復。 */
  gainExp(amount: number): number {
    const res = gainExp(this.save.player.level, this.save.player.exp, amount)
    this.save.player.level = res.level
    this.save.player.exp = res.exp
    bus.emit('player:exp-changed', { exp: res.exp, next: expToNext(res.level) })
    if (res.levelsGained > 0) {
      this.recompute()
      this.fullRestore()
      bus.emit('player:leveled', { level: res.level })
    }
    return res.levelsGained
  }

  collectLoot(itemId: string, count: number): void {
    grantLoot(this.save, this.data, itemId, count)
    bus.emit('loot:collected', { itemId, count })
  }

  markBossKilled(enemyId: string): boolean {
    if (this.save.killedBosses.includes(enemyId)) return false
    this.save.killedBosses.push(enemyId)
    return true
  }

  isBossFirstKill(enemyId: string): boolean {
    return !this.save.killedBosses.includes(enemyId)
  }

  acceptQuest(questId: string): boolean {
    return acceptQuest(this.save, questId)
  }

  /** 討伐を記録し、達成クエストの報酬を配る。達成クエストIDを返す。 */
  recordKill(enemyId: string): string[] {
    const completed = recordKill(this.save, this.data, enemyId)
    for (const questId of completed) {
      const quest = this.data.quests[questId]
      if (!quest) continue
      this.gainExp(quest.rewardExp)
      for (const r of quest.rewardItems) this.collectLoot(r.itemId, r.count)
    }
    return completed
  }

  /** 保存直前に HP/MP を書き戻す。 */
  syncForSave(): SaveData {
    this.save.player.hp = this.hp
    this.save.player.mp = this.mp
    return this.save
  }
}
