// 起動シーン。実PNG（あれば manifest.json 経由）を先に読み込み、
// 以降のシーンでプロシージャル生成器が「不足キーだけ」を埋める。

import Phaser from 'phaser'
import { assetUrl } from '../core/constants.ts'
import { CHAR_FRAME } from '../core/constants.ts'

interface AssetManifest {
  chars?: string[]
  enemies?: string[]
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    // manifest が無くても続行する
    this.load.on('loaderror', () => {})
    this.load.json('__manifest', assetUrl('assets/manifest.json'))
  }

  create(): void {
    const manifest = this.cache.json.get('__manifest') as AssetManifest | undefined
    const chars = manifest?.chars ?? []
    const enemies = manifest?.enemies ?? []
    if (chars.length === 0 && enemies.length === 0) {
      this.finish()
      return
    }
    for (const key of chars) {
      this.load.spritesheet(key, assetUrl(`assets/char/${key}.png`), {
        frameWidth: CHAR_FRAME,
        frameHeight: CHAR_FRAME,
      })
    }
    for (const key of enemies) {
      this.load.image(`enemy_${key}`, assetUrl(`assets/enemy/${key}.png`))
    }
    this.load.on('loaderror', () => {})
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.finish())
    this.load.start()
  }

  private finish(): void {
    this.scene.start('Title')
  }
}
