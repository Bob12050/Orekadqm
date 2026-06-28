// バトルエンジン本体（設計書5章）。UI非依存・シード乱数で再現可能。
// take*Turn が「1手番ぶん」を解決し BattleEvent[] を返す（演出はUI側）。
import type { Panel } from '../types'
import { createRng, type Rng } from '../reel/seededRng'
import { resolveStop } from '../reel/reelEngine'
import { ATTRIBUTE_LABEL } from './attributes'
import { computeDamage, effStat, hasStatus, hitChance } from './formulas'
import { resolveSkill, type SkillDef, type TargetShape } from './skills'
import { enemyPanelIndex, pickAttackTarget, pickWoundedAlly } from './ai'
import { makeParty } from './setup'
import type { BattleEvent, BattleUnit, Outcome, Side, StatusInstance, StatusKind, UnitInit } from './types'

const STATUS_LABEL: Record<StatusKind, string> = {
  poison: '毒',
  paralyze: '麻痺',
  sleep: '眠り',
  confuse: '混乱',
  seal: '封印',
  blind: '暗闇',
  atkUp: '攻撃UP',
  atkDown: '攻撃DOWN',
  defUp: '防御UP',
  defDown: '防御DOWN',
  haste: '加速',
  slow: '鈍足',
}

export class Battle {
  units: BattleUnit[]
  round = 0
  queue: string[] = []
  outcome: Outcome = 'ongoing'
  private rng: Rng

  constructor(allyInits: UnitInit[], enemyInits: UnitInit[], seed: string | number = 'battle') {
    this.units = [...makeParty(allyInits), ...makeParty(enemyInits)]
    this.rng = createRng(seed)
    this.startRound()
  }

  // ---- 参照系 ----
  get(uid: string): BattleUnit | undefined {
    return this.units.find((u) => u.uid === uid)
  }
  side(side: Side): BattleUnit[] {
    return this.units.filter((u) => u.side === side)
  }
  aliveOf(side: Side): BattleUnit[] {
    return this.units.filter((u) => u.side === side && u.alive)
  }
  get currentUid(): string | null {
    return this.queue[0] ?? null
  }
  get current(): BattleUnit | null {
    const uid = this.currentUid
    return uid ? this.get(uid) ?? null : null
  }
  isAllyTurn(): boolean {
    return this.current?.side === 'ally'
  }

  // ---- ラウンド管理 ----
  /** 行動順 = 実効素早さ降順 + 微乱数。同速は味方優先。 */
  private buildOrder(): string[] {
    const alive = this.units.filter((u) => u.alive)
    return alive
      .map((u) => ({
        uid: u.uid,
        key: effStat(u, 'spd') * (0.9 + this.rng() * 0.2) + (u.side === 'ally' ? 0.01 : 0),
      }))
      .sort((a, b) => b.key - a.key)
      .map((x) => x.uid)
  }

  private startRound(): BattleEvent[] {
    this.round += 1
    this.queue = this.buildOrder()
    return [
      {
        t: 'roundStart',
        round: this.round,
        order: [...this.queue],
        text: `── ラウンド ${this.round} ──`,
      },
    ]
  }

  /** 手番を1つ進める。空ならラウンド更新。 */
  private advance(events: BattleEvent[]): void {
    this.queue.shift()
    // 倒れたユニットをキューから除去
    this.queue = this.queue.filter((uid) => this.get(uid)?.alive)
    if (this.outcome === 'ongoing' && this.queue.length === 0) {
      events.push(...this.startRound())
    }
  }

  // ---- 手番実行 ----
  /** おまかせ用：現在ユニットのリール自動停止 index */
  autoPanelIndex(): number {
    const u = this.current
    if (!u) return 0
    return Math.floor(this.rng() * u.reel.length)
  }

  /** 味方の手番。panelIndex=停止位置、targetUid=ロック対象(無ければAI)。 */
  takeAllyTurn(panelIndex: number, targetUid?: string | null): BattleEvent[] {
    return this.resolveTurn(panelIndex, targetUid ?? null)
  }

  /** 敵の手番（AIが行動と対象を決定）。 */
  takeEnemyTurn(): BattleEvent[] {
    const u = this.current
    if (!u) return []
    const idx = enemyPanelIndex(u, this.rng)
    return this.resolveTurn(idx, null)
  }

  private resolveTurn(panelIndex: number, lockTargetUid: string | null): BattleEvent[] {
    const events: BattleEvent[] = []
    const actor = this.current
    if (!actor || !actor.alive || this.outcome !== 'ongoing') {
      this.advance(events)
      return events
    }

    events.push({ t: 'turnStart', uid: actor.uid, text: `${actor.name} の手番` })

    // 行動不能判定（眠り・麻痺）
    if (hasStatus(actor, 'sleep')) {
      if (this.rng() < 0.25) {
        this.removeStatus(actor, 'sleep')
        events.push({ t: 'wakeUp', uid: actor.uid, text: `${actor.name} は目をさました！` })
      } else {
        events.push({ t: 'incapacitated', uid: actor.uid, reason: 'sleep', text: `${actor.name} は眠っている…` })
        this.endOfTurn(actor, events)
        this.advance(events)
        return events
      }
    }
    if (hasStatus(actor, 'paralyze') && this.rng() < 0.3) {
      events.push({ t: 'incapacitated', uid: actor.uid, reason: 'paralyze', text: `${actor.name} はしびれて動けない！` })
      this.endOfTurn(actor, events)
      this.advance(events)
      return events
    }

    const panel = actor.reel[((panelIndex % actor.reel.length) + actor.reel.length) % actor.reel.length]
    const stop = resolveStop(actor.reel, panelIndex)

    // ミス枠 / 封印された必殺
    if (stop.isMiss) {
      events.push({ t: 'miss', uid: actor.uid, target: actor.uid, text: `${actor.name} は様子を見ている（ミス）` })
      this.endOfTurn(actor, events)
      this.advance(events)
      return events
    }
    if (panel.category === 'ultimate' && hasStatus(actor, 'seal')) {
      events.push({ t: 'miss', uid: actor.uid, target: actor.uid, text: `${actor.name} は封印されて必殺を出せない！` })
      this.endOfTurn(actor, events)
      this.advance(events)
      return events
    }

    const skill = resolveSkill(panel)
    const confused = hasStatus(actor, 'confuse')
    const targets = this.resolveTargets(actor, skill, lockTargetUid, confused)

    events.push({
      t: 'action',
      uid: actor.uid,
      skill: panel.skill,
      category: panel.category,
      targets: targets.map((t) => t.uid),
      text: `${actor.name} の ${panel.skill}！`,
    })

    for (const target of targets) {
      this.applyToTarget(actor, target, skill, events)
      if (this.outcome !== 'ongoing') break
    }

    this.endOfTurn(actor, events)
    this.checkOutcome(events)
    this.advance(events)
    return events
  }

  // ---- 対象決定 ----
  private opponentsOf(actor: BattleUnit): BattleUnit[] {
    return this.aliveOf(actor.side === 'ally' ? 'enemy' : 'ally')
  }
  private alliesOf(actor: BattleUnit): BattleUnit[] {
    return this.aliveOf(actor.side)
  }

  private resolveTargets(
    actor: BattleUnit,
    skill: SkillDef,
    lockTargetUid: string | null,
    confused: boolean,
  ): BattleUnit[] {
    const shape: TargetShape = skill.target
    if (shape === 'self') return [actor]
    if (shape === 'allyAll') return this.alliesOf(actor)
    if (shape === 'allySingle') {
      const w = pickWoundedAlly(this.alliesOf(actor))
      return w ? [w] : [actor]
    }
    if (shape === 'enemyAll') return this.opponentsOf(actor)

    const opp = this.opponentsOf(actor)
    if (opp.length === 0) return []

    if (shape === 'enemyRandom') {
      const hits = Math.max(1, skill.hits)
      const picks: BattleUnit[] = []
      for (let i = 0; i < hits; i++) picks.push(opp[Math.floor(this.rng() * opp.length)])
      return picks
    }

    // enemySingle
    if (confused) {
      // 混乱：味方含む全生存からランダム（自分以外）
      const all = this.units.filter((u) => u.alive && u.uid !== actor.uid)
      return all.length ? [all[Math.floor(this.rng() * all.length)]] : []
    }
    if (lockTargetUid) {
      const locked = this.get(lockTargetUid)
      if (locked && locked.alive && locked.side !== actor.side) return [locked]
    }
    const ai = pickAttackTarget(actor, opp, this.rng)
    return ai ? [ai] : []
  }

  // ---- 効果適用 ----
  private applyToTarget(actor: BattleUnit, target: BattleUnit, skill: SkillDef, events: BattleEvent[]): void {
    // 回復
    if (skill.heal && skill.heal > 0) {
      const amount = Math.round(target.maxHp * skill.heal)
      const before = target.hp
      target.hp = Math.min(target.maxHp, target.hp + amount)
      events.push({ t: 'heal', uid: actor.uid, target: target.uid, amount: target.hp - before, text: `${target.name} のHPが ${target.hp - before} 回復` })
    }

    // バフ
    if (skill.buff) {
      const recv = skill.buff.target === 'allyAll' ? this.alliesOf(actor) : [actor]
      for (const r of recv) {
        this.addStatus(r, { kind: skill.buff.kind, remaining: skill.buff.duration, magnitude: skill.buff.magnitude })
        events.push({ t: 'buff', uid: actor.uid, target: r.uid, kind: skill.buff.kind, text: `${r.name} は ${STATUS_LABEL[skill.buff.kind]}` })
      }
    }

    // ダメージ
    if (skill.damageType !== 'none' && skill.power > 0) {
      const hit = this.rng() < hitChance(actor, target)
      if (!hit) {
        events.push({ t: 'miss', uid: actor.uid, target: target.uid, text: `${target.name} はかわした！` })
      } else {
        const dr = computeDamage(actor, target, skill, this.rng)
        target.hp = Math.max(0, target.hp - dr.amount)
        // 被弾で起床
        if (hasStatus(target, 'sleep')) {
          this.removeStatus(target, 'sleep')
          events.push({ t: 'wakeUp', uid: target.uid, text: `${target.name} は目をさました！` })
        }
        const effText = dr.effectiveness === 'weak' ? ' 弱点!' : dr.effectiveness === 'resist' ? ' 耐性…' : ''
        const critText = dr.crit ? ' 会心!' : ''
        const berserkText = dr.berserk ? ' 暴走!!' : ''
        events.push({
          t: 'damage',
          uid: actor.uid,
          target: target.uid,
          amount: dr.amount,
          crit: dr.crit,
          berserk: dr.berserk,
          effectiveness: dr.effectiveness,
          text: `${target.name} に ${dr.amount} ダメージ${effText}${critText}${berserkText}`,
        })
        // 吸収
        if (skill.drain && skill.drain > 0) {
          const healed = Math.round(dr.amount * skill.drain)
          const before = actor.hp
          actor.hp = Math.min(actor.maxHp, actor.hp + healed)
          events.push({ t: 'drain', uid: actor.uid, amount: actor.hp - before, text: `${actor.name} は ${actor.hp - before} 吸収した` })
        }
        this.faintIfDead(target, events)
      }
    }

    // 状態異常付与（ダメージ命中の有無に関わらず判定する技もあるが、簡易に常時判定）
    if (skill.status && target.alive) {
      if (this.rng() < skill.status.chance) {
        this.addStatus(target, {
          kind: skill.status.kind,
          remaining: skill.status.duration,
          magnitude: skill.status.magnitude ?? 1,
        })
        events.push({ t: 'status', uid: actor.uid, target: target.uid, kind: skill.status.kind, text: `${target.name} は ${STATUS_LABEL[skill.status.kind]}状態` })
      }
    }
  }

  // ---- 状態異常 ----
  private addStatus(unit: BattleUnit, s: StatusInstance): void {
    // 同種は上書き（持続をリフレッシュ）
    this.removeStatus(unit, s.kind)
    unit.statuses.push({ ...s })
  }
  private removeStatus(unit: BattleUnit, kind: StatusKind): void {
    unit.statuses = unit.statuses.filter((x) => x.kind !== kind)
  }

  /** 手番終了処理：毒ダメージ → 持続ターンの減算・期限切れ除去 */
  private endOfTurn(unit: BattleUnit, events: BattleEvent[]): void {
    if (!unit.alive) return
    const poison = unit.statuses.find((s) => s.kind === 'poison')
    if (poison) {
      const dmg = Math.max(1, Math.round(unit.maxHp * poison.magnitude))
      unit.hp = Math.max(0, unit.hp - dmg)
      events.push({ t: 'poisonTick', uid: unit.uid, amount: dmg, text: `${unit.name} は毒で ${dmg} ダメージ` })
      this.faintIfDead(unit, events)
    }
    unit.statuses = unit.statuses
      .map((s) => ({ ...s, remaining: s.remaining - 1 }))
      .filter((s) => s.remaining > 0)
  }

  private faintIfDead(unit: BattleUnit, events: BattleEvent[]): void {
    if (unit.alive && unit.hp <= 0) {
      unit.alive = false
      unit.statuses = []
      events.push({ t: 'faint', uid: unit.uid, text: `${unit.name} は たおれた！` })
    }
  }

  private checkOutcome(events: BattleEvent[]): void {
    if (this.outcome !== 'ongoing') return
    if (this.aliveOf('enemy').length === 0) {
      this.outcome = 'win'
      events.push({ t: 'outcome', outcome: 'win', text: 'たたかいに かった！' })
    } else if (this.aliveOf('ally').length === 0) {
      this.outcome = 'lose'
      events.push({ t: 'outcome', outcome: 'lose', text: 'ぜんめつ してしまった…' })
    }
  }

  /** デバッグ/UI用：状態異常ラベル */
  static statusLabel(kind: StatusKind): string {
    return STATUS_LABEL[kind]
  }
  static attributeLabel = ATTRIBUTE_LABEL
}

export type { Panel }
