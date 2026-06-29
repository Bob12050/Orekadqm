// バトルエンジン本体（設計書5章）。UI非依存・シード乱数で再現可能。
// take*Turn が「1手番ぶん」を解決し BattleEvent[] を返す（演出はUI側）。
import type { Panel } from '../types'
import { createRng, type Rng } from '../reel/seededRng'
import { resolveStop } from '../reel/reelEngine'
import { ATTRIBUTE_LABEL } from './attributes'
import { computeDamage, effStat, hasStatus, hitChance } from './formulas'
import { resolveSkill, type SkillDef, type TargetShape } from './skills'
import { chooseMoveIndex, pickAttackTarget, pickWoundedAlly } from './ai'
import { moveCost, MP_REGEN } from './cost'
import { makeParty, makeUnit } from './setup'
import { GAUGE_MAX, scoutFactors, type ScoutFactors } from './scout'
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
  units!: BattleUnit[]
  round!: number
  queue!: string[]
  outcome!: Outcome
  scoutGauge!: number // 共通スカウトゲージ(0..GAUGE_MAX)
  bonds!: Record<string, number> // 敵uid→絆ポイント(失敗で蓄積)
  recruited!: BattleUnit[] // スカウト成功した仲間
  private rng!: Rng
  private summonCount = 0

  constructor(allyInits: UnitInit[], enemyInits: UnitInit[], seed: string | number = 'battle') {
    this.setup([...makeParty(allyInits), ...makeParty(enemyInits)], seed)
  }

  /** 事前生成したユニット配列から直接構築（所持個体の育ったリールを持ち込む用） */
  static fromUnits(units: BattleUnit[], seed: string | number = 'battle'): Battle {
    const b: Battle = Object.create(Battle.prototype)
    b.setup(units, seed)
    return b
  }

  private setup(units: BattleUnit[], seed: string | number): void {
    this.units = units
    this.round = 0
    this.queue = []
    this.outcome = 'ongoing'
    this.scoutGauge = 0
    this.bonds = {}
    this.recruited = []
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
    const events: BattleEvent[] = [
      {
        t: 'roundStart',
        round: this.round,
        order: [...this.queue],
        text: `── ラウンド ${this.round} ──`,
      },
    ]
    this.processBossGimmicks(events)
    return events
  }

  /** ボスギミック処理（設計書5-11）: 属性シフト / フェーズ移行(怒り) / とりまき召喚 */
  private processBossGimmicks(events: BattleEvent[]): void {
    for (const u of this.aliveOf('enemy')) {
      if (!u.gimmicks || u.gimmicks.length === 0) continue

      // 属性シフト: ラウンドごとに弱点属性が巡回 → 柔軟な編成を要求
      if (u.gimmicks.includes('attributeShift') && u.shiftCycle && u.shiftCycle.length > 0 && this.round > 1) {
        const next = u.shiftCycle[(this.round - 1) % u.shiftCycle.length]
        if (next !== u.attribute) {
          u.attribute = next
          events.push({ t: 'attributeShift', uid: u.uid, attribute: next, text: `${u.name} は属性を ${ATTRIBUTE_LABEL[next]} に変えた！` })
        }
      }

      // フェーズ移行: HP割合で3段階。新フェーズ突入で怒り(攻撃UP+加速)＋召喚
      const ratio = u.hp / u.maxHp
      const newPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3
      const cur = u.phase ?? 1
      if (newPhase > cur) {
        u.phase = newPhase
        events.push({ t: 'phaseChange', uid: u.uid, phase: newPhase, text: `${u.name} は本気を出した！（フェーズ${newPhase}）` })
        this.addStatus(u, { kind: 'atkUp', remaining: 99, magnitude: 1.0 + 0.15 * newPhase })
        this.addStatus(u, { kind: 'haste', remaining: 99, magnitude: 1.15 })
        if (u.gimmicks.includes('summon')) this.summonMinion(u, events)
      }
    }
  }

  private summonMinion(boss: BattleUnit, events: BattleEvent[]): void {
    if (this.aliveOf('enemy').length >= 4 || !boss.minionSpeciesId) return
    this.summonCount += 1
    const unit = makeUnit({
      speciesId: boss.minionSpeciesId,
      level: boss.minionLevel ?? 5,
      side: 'enemy',
      slot: 80 + this.summonCount, // 既存スロットと衝突しない
    })
    this.units.push(unit)
    this.queue.push(unit.uid) // このラウンドの行動キュー末尾に追加
    events.push({ t: 'summon', uid: boss.uid, name: unit.name, text: `${boss.name} は ${unit.name} を呼び寄せた！` })
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
  /** オート/AI用：MPで使える技から自動選択 */
  autoPanelIndex(): number {
    const u = this.current
    if (!u) return 0
    return chooseMoveIndex(u, this.rng)
  }

  /** 味方の手番。panelIndex=選んだ技、targetUid=ロック対象(無ければAI)。 */
  takeAllyTurn(panelIndex: number, targetUid?: string | null): BattleEvent[] {
    return this.resolveTurn(panelIndex, targetUid ?? null)
  }

  /** 敵の手番（AIが行動と対象を決定）。 */
  takeEnemyTurn(): BattleEvent[] {
    const u = this.current
    if (!u) return []
    const idx = chooseMoveIndex(u, this.rng)
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

    // MP回復（手番開始ごと）
    actor.mp = Math.min(actor.maxMp, actor.mp + MP_REGEN)

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

    // MP消費（コストを払って技を使う）
    actor.mp = Math.max(0, actor.mp - moveCost(panel))

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
        // スカウトゲージ蓄積（味方が攻撃を当てた／弱点ヒット、味方が被弾）
        if (actor.side === 'ally') this.fillGauge(dr.effectiveness === 'weak' ? 20 : 12)
        else if (target.side === 'ally') this.fillGauge(6)
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
        if (actor.side === 'ally') this.fillGauge(6)
      }
    }
  }

  private fillGauge(amount: number): void {
    this.scoutGauge = Math.min(GAUGE_MAX, this.scoutGauge + amount)
  }

  // ---- スカウト（設計書6章） ----
  get gaugeReady(): boolean {
    return this.scoutGauge >= GAUGE_MAX
  }

  /** 対象の成功率内訳（UI表示用） */
  scoutFactorsFor(uid: string): ScoutFactors | null {
    const t = this.get(uid)
    if (!t) return null
    return scoutFactors(t, this.bonds[uid] ?? 0)
  }

  scoutChanceFor(uid: string): number {
    return this.scoutFactorsFor(uid)?.chance ?? 0
  }

  /** その敵を今スカウトできるか（ゲージ満タン＆スカウト可能＆敵＆生存） */
  canScout(uid: string): boolean {
    if (!this.gaugeReady || this.outcome !== 'ongoing') return false
    if (!this.isAllyTurn()) return false
    const t = this.get(uid)
    return !!t && t.alive && t.side === 'enemy' && t.scoutable
  }

  /** 味方の手番でスカウトを試みる（手番を消費）。 */
  takeAllyScout(targetUid: string): BattleEvent[] {
    const events: BattleEvent[] = []
    const actor = this.current
    const target = this.get(targetUid)
    if (!actor || actor.side !== 'ally' || !target || !this.canScout(targetUid)) {
      return events
    }
    events.push({ t: 'turnStart', uid: actor.uid, text: `${actor.name} の手番` })
    const f = scoutFactors(target, this.bonds[targetUid] ?? 0)
    this.scoutGauge = 0 // ゲージ消費
    events.push({ t: 'scoutAttempt', uid: actor.uid, target: targetUid, chance: f.chance, text: `${actor.name} は ${target.name} にスカウトアタック！（成功率${Math.round(f.chance * 100)}%）` })

    if (this.rng() < f.chance) {
      // 成功：仲間化（フィールドから去り recruited へ）
      this.recruited.push(target)
      this.units = this.units.filter((u) => u.uid !== targetUid)
      this.queue = this.queue.filter((uid) => uid !== targetUid)
      events.push({ t: 'scoutSuccess', target: targetUid, name: target.name, text: `${target.name} は なかまになった！` })
    } else {
      // 失敗：絆ポイント+1（次回成功率UP）＋対象が怒る（攻撃UP）＝軽いリスク
      this.bonds[targetUid] = (this.bonds[targetUid] ?? 0) + 1
      this.addStatus(target, { kind: 'atkUp', remaining: 2, magnitude: 1.2 })
      events.push({ t: 'scoutFail', target: targetUid, bond: this.bonds[targetUid], text: `スカウト失敗… ${target.name} は怒っている（絆+1で次は成功しやすい）` })
    }

    this.endOfTurn(actor, events)
    this.checkOutcome(events)
    this.advance(events)
    return events
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
