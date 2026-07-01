// WebAudio 合成エンジン。初回タップで unlock、非表示で suspend、
// 同一SEはレート制限、ON/OFF は localStorage に保存。

import { SFX_DEFS, type SfxDef } from './sfx-defs.ts'

const LS_KEY = 'orekadqm.sfx'

export class SfxEngine {
  private ctx: AudioContext | null = null
  private enabled: boolean
  private readonly lastPlayed = new Map<string, number>()
  private noiseBuffer: AudioBuffer | null = null

  constructor() {
    this.enabled = localStorage.getItem(LS_KEY) !== 'off'
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    localStorage.setItem(LS_KEY, on ? 'on' : 'off')
    if (on) void this.ctx?.resume()
    else void this.ctx?.suspend()
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled)
    return this.enabled
  }

  /** 初回タップで呼ぶ。AudioContext を生成/再開する。 */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
      this.noiseBuffer = this.buildNoise(this.ctx)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** タブ非表示など、一時停止。 */
  suspend(): void {
    void this.ctx?.suspend()
  }

  resume(): void {
    if (this.enabled) void this.ctx?.resume()
  }

  private buildNoise(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.4)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    // 決定的な擬似ノイズ（Math.random を避ける必要はないがシンプルに）
    let s = 22222
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0
      data[i] = ((s >>> 8) / 8388608 - 1) * 0.6
    }
    return buf
  }

  play(id: string): void {
    if (!this.enabled) return
    const def = SFX_DEFS[id]
    if (!def || !this.ctx) return
    const now = this.ctx.currentTime * 1000
    const last = this.lastPlayed.get(id) ?? -Infinity
    if (now - last < def.minGapMs) return
    this.lastPlayed.set(id, now)
    this.render(this.ctx, def)
  }

  private render(ctx: AudioContext, def: SfxDef): void {
    const t0 = ctx.currentTime
    const dur = def.durationMs / 1000
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, t0)
    master.gain.exponentialRampToValueAtTime(def.gain, t0 + 0.008)
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    master.connect(ctx.destination)

    const osc = ctx.createOscillator()
    osc.type = def.wave
    osc.frequency.setValueAtTime(def.freqStart, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, def.freqEnd), t0 + dur)
    osc.connect(master)
    osc.start(t0)
    osc.stop(t0 + dur)

    if (def.noise > 0 && this.noiseBuffer) {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(def.noise * def.gain, t0)
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.min(dur, 0.12))
      src.connect(ng)
      ng.connect(ctx.destination)
      src.start(t0)
      src.stop(t0 + Math.min(dur, 0.12))
    }
  }
}
