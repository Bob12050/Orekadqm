// キャラアニメの登録。frameIndex = 行番号*4 + フレーム番号（不変仕様）。
// right は left を setFlipX(true) で使うので left の anim を共有する。

import Phaser from 'phaser'
import { DIR_ROW_BASE, POSE_ROW, POSE_SPECS, type Facing, type PoseName } from '../../core/constants.ts'

const ANIM_FACINGS: Exclude<Facing, 'right'>[] = ['down', 'up', 'left']
const POSES: PoseName[] = ['idle', 'walk', 'attack', 'cast', 'hurt', 'death']

export function animKey(charKey: string, facing: Facing, pose: PoseName): string {
  const f: Facing = facing === 'right' ? 'left' : facing
  return `${charKey}_${f}_${pose}`
}

/** 1キャラ分のアニメを登録（既存ならスキップ）。 */
export function registerCharacterAnims(scene: Phaser.Scene, charKey: string): void {
  for (const facing of ANIM_FACINGS) {
    for (const pose of POSES) {
      const key = animKey(charKey, facing, pose)
      if (scene.anims.exists(key)) continue
      const spec = POSE_SPECS[pose]
      const row = DIR_ROW_BASE[facing] + POSE_ROW[pose]
      const start = row * 4
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(charKey, {
          start,
          end: start + spec.frames - 1,
        }),
        frameRate: spec.fps,
        repeat: spec.loop ? -1 : 0,
      })
    }
  }
}
