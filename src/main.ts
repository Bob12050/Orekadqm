// エントリ。フォントをゲーム起動前に待ってから Phaser.Game を生成する
// （Phaser はテキストを canvas に焼くので後からフォントが来ても反映されない）。

import Phaser from 'phaser'
import { bus } from './core/EventBus.ts'
import { LOGICAL_HEIGHT_MAX, LOGICAL_HEIGHT_MIN, LOGICAL_WIDTH } from './core/constants.ts'
import { SfxEngine } from './audio/SfxEngine.ts'
import { BootScene } from './scenes/BootScene.ts'
import { TitleScene } from './scenes/TitleScene.ts'
import { WorldScene } from './scenes/WorldScene.ts'
import { HudScene } from './scenes/HudScene.ts'

function logicalHeight(): number {
  const ratio = window.innerHeight / Math.max(1, window.innerWidth)
  return Phaser.Math.Clamp(Math.round(LOGICAL_WIDTH * ratio), LOGICAL_HEIGHT_MIN, LOGICAL_HEIGHT_MAX)
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function waitForFont(): Promise<void> {
  if (!('fonts' in document)) return
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('16px "DotGothic16"'),
        document.fonts.load('bold 16px "DotGothic16"'),
      ]).then(() => undefined),
      timeout(1500), // タイムアウトでフォールバック起動
    ])
  } catch {
    /* フォント読込失敗でも起動は続ける */
  }
}

function buildRotateWarning(): HTMLElement {
  const el = document.createElement('div')
  el.id = 'rotate-warn'
  el.textContent = 'たてむきにしてください'
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0c0718',
    color: '#eadfff',
    fontFamily: 'DotGothic16, system-ui, sans-serif',
    fontSize: '18px',
    zIndex: '9999',
  })
  document.body.appendChild(el)
  return el
}

function start(): void {
  const height = logicalHeight()
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: LOGICAL_WIDTH,
    height,
    backgroundColor: '#0c0718',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      activePointers: 4, // マルチタッチ必須（スティック＋ボタン同時押し）
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false, gravity: { x: 0, y: 0 } },
    },
    scene: [BootScene, TitleScene, WorldScene, HudScene],
  })

  // SE エンジン（プログラム合成）
  const sfx = new SfxEngine()
  bus.on('sfx:play', ({ id }) => sfx.play(id))
  game.registry.set('sfxToggle', () => sfx.toggle())

  const unlock = (): void => sfx.unlock()
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('touchstart', unlock, { passive: true })

  // タブ/PWA 非表示で一時停止＋自動保存
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sfx.suspend()
      bus.emit('game:save-requested', {})
      if (game.scene.isActive('World')) game.scene.pause('World')
    } else {
      sfx.resume()
      const landscape = window.innerWidth > window.innerHeight
      if (!landscape && game.scene.isPaused('World')) game.scene.resume('World')
    }
  })

  // 横画面ではポーズ＋警告オーバーレイ（メニューの input.paused とは独立に扱う）
  const warn = buildRotateWarning()
  const checkOrient = (): void => {
    const landscape = window.innerWidth > window.innerHeight
    warn.style.display = landscape ? 'flex' : 'none'
    if (landscape && game.scene.isActive('World')) {
      game.scene.pause('World')
    } else if (!landscape && game.scene.isPaused('World')) {
      game.scene.resume('World')
    }
  }
  window.addEventListener('resize', checkOrient)
  window.addEventListener('orientationchange', checkOrient)
  checkOrient()

  // 起動スプラッシュを消す
  const splash = document.getElementById('boot-splash')
  splash?.remove()
}

void waitForFont().then(start)
