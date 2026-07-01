// 効果音は WebAudio プログラム合成（音源ファイル不要）。
// SE定義は純データ、再生エンジンとは分離する。

export type SfxWave = 'sine' | 'square' | 'sawtooth' | 'triangle'

export interface SfxDef {
  id: string
  wave: SfxWave
  /** 開始周波数 (Hz)。 */
  freqStart: number
  /** 終了周波数 (Hz)。グライドする。 */
  freqEnd: number
  /** 継続時間 (ms)。 */
  durationMs: number
  /** ピーク音量 (0..1)。 */
  gain: number
  /** ノイズ成分を混ぜる（打撃・爆発系）。 */
  noise: number
  /** 同一SEの最短再生間隔 (ms)。レート制限。 */
  minGapMs: number
}

export const SFX_DEFS: Record<string, SfxDef> = {
  ui_select: { id: 'ui_select', wave: 'square', freqStart: 520, freqEnd: 520, durationMs: 60, gain: 0.18, noise: 0, minGapMs: 40 },
  ui_confirm: { id: 'ui_confirm', wave: 'square', freqStart: 480, freqEnd: 720, durationMs: 110, gain: 0.22, noise: 0, minGapMs: 60 },
  ui_cancel: { id: 'ui_cancel', wave: 'square', freqStart: 400, freqEnd: 220, durationMs: 110, gain: 0.2, noise: 0, minGapMs: 60 },
  attack_swing: { id: 'attack_swing', wave: 'triangle', freqStart: 320, freqEnd: 180, durationMs: 90, gain: 0.16, noise: 0.25, minGapMs: 70 },
  hit_phys: { id: 'hit_phys', wave: 'square', freqStart: 220, freqEnd: 120, durationMs: 90, gain: 0.24, noise: 0.5, minGapMs: 40 },
  hit_crit: { id: 'hit_crit', wave: 'sawtooth', freqStart: 300, freqEnd: 90, durationMs: 150, gain: 0.3, noise: 0.6, minGapMs: 40 },
  enemy_hurt: { id: 'enemy_hurt', wave: 'square', freqStart: 260, freqEnd: 200, durationMs: 70, gain: 0.16, noise: 0.3, minGapMs: 40 },
  enemy_die: { id: 'enemy_die', wave: 'sawtooth', freqStart: 260, freqEnd: 60, durationMs: 260, gain: 0.24, noise: 0.4, minGapMs: 80 },
  drop_get: { id: 'drop_get', wave: 'square', freqStart: 640, freqEnd: 960, durationMs: 120, gain: 0.2, noise: 0, minGapMs: 50 },
  level_up: { id: 'level_up', wave: 'square', freqStart: 520, freqEnd: 1040, durationMs: 320, gain: 0.26, noise: 0, minGapMs: 200 },
  boss_roar: { id: 'boss_roar', wave: 'sawtooth', freqStart: 160, freqEnd: 50, durationMs: 520, gain: 0.3, noise: 0.5, minGapMs: 300 },
  quest_clear: { id: 'quest_clear', wave: 'triangle', freqStart: 600, freqEnd: 900, durationMs: 420, gain: 0.24, noise: 0, minGapMs: 200 },
}

export type SfxId = keyof typeof SFX_DEFS
