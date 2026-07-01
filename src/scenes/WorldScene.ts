// ゲーム本体シーン。町/フィールド/アリーナを1シーンで扱い、mapId で切り替える。
// 移動・攻撃・敵AI・ドロップ・クエスト進行・出口遷移・オートセーブを束ねる。

import Phaser from 'phaser'
import { bus } from '../core/EventBus.ts'
import { CHAR_FRAME, type Facing } from '../core/constants.ts'
import type { MapDef } from '../data/types.ts'
import type { Session } from '../state/Session.ts'
import { consumeEdges, input } from '../state/input.ts'
import { ensurePlaceholders } from '../gen/registry.ts'
import { resolveHit } from '../combat/damage.ts'
import { rollDrops } from '../combat/drops.ts'
import { writeSave } from '../save/db.ts'
import { MapRenderer } from './world/MapRenderer.ts'
import { PlayerActor } from './world/PlayerActor.ts'
import { EnemyActor } from './world/EnemyActor.ts'
import { DamageNumbers } from './world/DamageNumbers.ts'
import { LootManager } from './world/LootManager.ts'

interface WorldInit {
  session: Session
  mapId: string
}

const FACE_VEC: Record<Facing, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export class WorldScene extends Phaser.Scene {
  private session!: Session
  private mapDef!: MapDef
  private mapView!: MapRenderer
  private player!: PlayerActor
  private enemies: EnemyActor[] = []
  private enemyGroup!: Phaser.Physics.Arcade.Group
  private dmg!: DamageNumbers
  private loot!: LootManager
  private transitioning = false
  private saveTimer = 0

  constructor() {
    super('World')
  }

  init(data: WorldInit): void {
    this.session = data.session
    const map = this.session.data.maps[data.mapId]
    if (!map) throw new Error(`未知のマップ: ${data.mapId}`)
    this.mapDef = map
    this.enemies = []
    this.transitioning = false
  }

  create(): void {
    ensurePlaceholders(this, this.session.data)
    this.cameras.main.setBackgroundColor('#0c0718')
    this.mapView = new MapRenderer(this, this.mapDef)
    this.dmg = new DamageNumbers(this)
    this.loot = new LootManager(this, this.session)

    const start = this.mapView.playerStart()
    this.player = new PlayerActor(this, start.x, start.y, this.session.job.appearance)

    this.cameras.main.setBounds(0, 0, this.mapView.widthPx, this.mapView.heightPx)
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12)
    this.cameras.main.setRoundPixels(true)

    this.enemyGroup = this.physics.add.group()
    this.spawnEnemies()

    this.physics.add.collider(this.player.phys, this.enemyGroup, (_pp, ep) =>
      this.onContact(ep),
    )

    // HUD をオーバーレイ起動
    if (!this.scene.isActive('Hud')) {
      this.scene.launch('Hud', { session: this.session })
    }
    bus.emit('toast', { text: this.mapDef.name })
    bus.emit('player:hp-changed', { hp: this.session.hp, maxHp: this.session.derived.maxHp })
    bus.emit('player:mp-changed', { mp: this.session.mp, maxMp: this.session.derived.maxMp })

    const offSave = bus.on('game:save-requested', () => void this.autosave())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.loot.clear()
      offSave()
    })
  }

  private spawnEnemies(): void {
    let seed = 7
    for (const spawn of this.mapDef.spawns) {
      const def = this.session.data.enemies[spawn.enemy]
      if (!def) continue
      const pts = this.mapView.spawnPoints(spawn.count, (seed += 31))
      for (const pt of pts) {
        if (this.enemies.length >= 12) break // 画面内通常敵は最大12体
        const enemy = new EnemyActor(this, def, pt.x, pt.y)
        enemy.phys.setData('actor', enemy)
        this.enemyGroup.add(enemy.phys)
        this.enemies.push(enemy)
      }
      if (def.isBoss) bus.emit('sfx:play', { id: 'boss_roar' })
    }
  }

  update(_time: number, delta: number): void {
    if (input.paused) {
      this.player.setMoveInput(0, 0, 0)
      return
    }
    const speed = this.session.derived.moveSpeed
    this.player.setMoveInput(input.moveX, input.moveY, speed)
    this.player.syncSprite()

    const edges = consumeEdges()
    if (edges.attack) this.doAttack()
    if (edges.skill) this.doSkill()
    if (edges.examine) this.tryExit(true)

    for (const enemy of this.enemies) enemy.update(this.player.x, this.player.y, delta)
    this.loot.update(this.player.x, this.player.y)
    this.tryExit(false)

    this.saveTimer += delta
    if (this.saveTimer > 15000) {
      this.saveTimer = 0
      void this.autosave()
    }
  }

  private doAttack(): void {
    bus.emit('sfx:play', { id: 'attack_swing' })
    this.player.attack((facing) => this.resolveMelee(facing, 1, this.session.weaponElement(), false))
  }

  private doSkill(): void {
    const skillId = this.session.save.player.learnedSkills[0]
    const skill = skillId ? this.session.data.skills[skillId] : undefined
    if (!skill) {
      bus.emit('toast', { text: 'おぼえた技がない' })
      return
    }
    if (!this.session.spendMp(skill.mpCost)) {
      bus.emit('toast', { text: 'MPがたりない' })
      return
    }
    bus.emit('sfx:play', { id: 'attack_swing' })
    const element = skill.element ?? this.session.weaponElement()
    this.player.cast(() => {
      if (skill.effect.type === 'heal') {
        this.session.heal(skill.effect.power)
        this.dmg.show(this.player.x, this.player.y - CHAR_FRAME * 0.5, skill.effect.power, 'holy', false)
        bus.emit('toast', { text: `${skill.name}！` })
        return
      }
      if (skill.effect.type === 'projectile') {
        this.launchProjectile(element, skill.effect.power)
        return
      }
      this.resolveMelee(this.player.facing, skill.effect.power, element, true)
    })
  }

  private resolveMelee(facing: Facing, power: number, element: ReturnType<Session['weaponElement']>, wide: boolean): void {
    const dir = FACE_VEC[facing]
    const reach = wide ? 56 : 40
    const cx = this.player.x + dir.x * 24
    const cy = this.player.y + dir.y * 24 - 8
    let hitAny = false
    for (const enemy of this.enemies) {
      if (enemy.dead) continue
      const d = Math.hypot(enemy.x - cx, enemy.y - cy)
      if (d > reach) continue
      hitAny = true
      this.hitEnemy(enemy, power, element)
    }
    if (!hitAny) return
  }

  private launchProjectile(element: ReturnType<Session['weaponElement']>, power: number): void {
    const dir = FACE_VEC[this.player.facing]
    const startX = this.player.x + dir.x * 16
    const startY = this.player.y - 24
    // 前方最寄りの敵を探す
    let target: EnemyActor | null = null
    let best = 200
    for (const enemy of this.enemies) {
      if (enemy.dead) continue
      const dx = enemy.x - this.player.x
      const dy = enemy.y - this.player.y
      if (dx * dir.x + dy * dir.y < 0) continue
      const d = Math.hypot(dx, dy)
      if (d < best) {
        best = d
        target = enemy
      }
    }
    const orb = this.add.circle(startX, startY, 5, 0xff6a3d).setDepth(200000)
    orb.setStrokeStyle(2, 0xffd25a)
    const tx = target ? target.x : this.player.x + dir.x * 180
    const ty = target ? target.y - 8 : startY + dir.y * 180
    this.tweens.add({
      targets: orb,
      x: tx,
      y: ty,
      duration: Math.max(140, best * 1.4),
      onComplete: () => {
        orb.destroy()
        if (target && !target.dead) this.hitEnemy(target, power, element)
      },
    })
  }

  private hitEnemy(enemy: EnemyActor, power: number, element: ReturnType<Session['weaponElement']>): void {
    const hit = resolveHit(
      { atk: this.session.basicAtk(), critRate: this.session.derived.critRate, element, power },
      { def: enemy.def, profile: enemy.elementProfile },
      this.session.rng,
    )
    this.dmg.show(enemy.x, enemy.y - enemy.def_.visual.size, hit.amount, hit.element, hit.crit)
    bus.emit('sfx:play', { id: hit.crit ? 'hit_crit' : 'hit_phys' })
    const died = enemy.takeDamage(hit.amount)
    if (died) this.onEnemyDefeated(enemy)
    else bus.emit('sfx:play', { id: 'enemy_hurt' })
  }

  private onEnemyDefeated(enemy: EnemyActor): void {
    const def = enemy.def_
    bus.emit('sfx:play', { id: 'enemy_die' })
    this.session.gainExp(def.exp)

    const table = this.session.data.dropTables[def.dropTable]
    if (table) {
      const firstKill = def.isBoss && this.session.isBossFirstKill(def.id)
      const drops = rollDrops(table, this.session.rng, { firstKill, rolls: def.isBoss ? 3 : 1 })
      for (const drop of drops) {
        this.loot.drop(enemy.x, enemy.y - 6, drop.itemId, drop.count, drop.special)
      }
    }
    if (def.isBoss) this.session.markBossKilled(def.id)

    const completed = this.session.recordKill(def.id)
    for (const questId of completed) {
      const quest = this.session.data.quests[questId]
      bus.emit('sfx:play', { id: 'quest_clear' })
      bus.emit('toast', { text: `クエスト達成: ${quest?.name ?? questId}` })
    }
    this.enemies = this.enemies.filter((e) => e !== enemy)
  }

  private onContact(
    enemyPhys:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): void {
    if (this.player.dead) return
    const go = enemyPhys as unknown as Phaser.GameObjects.GameObject
    const enemy = go.getData?.('actor') as EnemyActor | undefined
    if (!enemy || enemy.dead || enemy.touchCooldown > 0) return
    enemy.touchCooldown = 800
    const raw = Math.max(1, enemy.touchDamage - Math.round(this.session.derived.def * 0.4))
    this.session.damage(raw)
    this.dmg.show(this.player.x, this.player.y - CHAR_FRAME * 0.5, raw, 'none', false)
    bus.emit('sfx:play', { id: 'hit_phys' })
    this.player.hurt()
    this.cameras.main.shake(120, 0.006)
    if (this.session.hp <= 0) this.onPlayerDown()
  }

  private onPlayerDown(): void {
    this.player.die()
    input.paused = true
    bus.emit('toast', { text: 'ちからつきた… 町へもどる' })
    this.time.delayedCall(1400, () => {
      this.session.fullRestore()
      input.paused = false
      this.goTo('map_town')
    })
  }

  private tryExit(force: boolean): void {
    if (this.transitioning) return
    for (const zone of this.mapView.exits) {
      const d = Math.hypot(this.player.x - zone.x, this.player.y - zone.y)
      if (d < (force ? 40 : 16)) {
        this.goTo(zone.exit.toMap)
        return
      }
    }
  }

  private goTo(mapId: string): void {
    if (this.transitioning) return
    this.transitioning = true
    bus.emit('sfx:play', { id: 'ui_confirm' })
    void this.autosave()
    this.cameras.main.fadeOut(220, 6, 4, 16)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ session: this.session, mapId })
    })
  }

  private async autosave(): Promise<void> {
    try {
      await writeSave(this.session.syncForSave())
      bus.emit('game:saved', { at: Date.now() })
    } catch {
      /* セーブ失敗は致命ではない */
    }
  }
}
