// プロシージャル・ドット絵の描画ツールキット。
// 「そこまで荒くないドット感」を狙い、細かめのピクセル＋1pxのクリーンな輪郭＋
// 控えめなセルシェード（面ごとに明暗2〜3段）で描く。自由回転・ぼかしは使わない。

export interface Ctx2D {
  ctx: CanvasRenderingContext2D
}

/** 平面キャンバスを用意（アンチエイリアス無効）。 */
export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (ctx) ctx.imageSmoothingEnabled = false
  return c
}

/** 整数座標の塗り矩形。 */
export function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/**
 * 輪郭つきブロック。まず1px大きい暗色を敷き、内側を塗る。
 * 角を1pxずつ削って柔らかいシルエットにする（roundで丸みを演出）。
 */
export function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  outline: string,
  round = 1,
): void {
  px(ctx, x - 1, y - 1, w + 2, h + 2, outline)
  px(ctx, x, y, w, h, fill)
  if (round > 0) {
    // 4隅を輪郭色で削って丸める
    for (let i = 0; i < round; i++) {
      const o = i
      px(ctx, x - 1 + o, y - 1 + o, 1, 1, outline)
      px(ctx, x + w - o, y - 1 + o, 1, 1, outline)
      px(ctx, x - 1 + o, y + h - o, 1, 1, outline)
      px(ctx, x + w - o, y + h - o, 1, 1, outline)
      // 塗り側の角も1px戻す
      px(ctx, x + o, y + o, 1, 1, outline)
      px(ctx, x + w - 1 - o, y + o, 1, 1, outline)
      px(ctx, x + o, y + h - 1 - o, 1, 1, outline)
      px(ctx, x + w - 1 - o, y + h - 1 - o, 1, 1, outline)
    }
  }
}

/** ハイライト/シェードの帯（セルシェード）。 */
export function band(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  px(ctx, x, y, w, h, color)
}

/** 16進色を混ぜて明暗を作る。t<0で暗く、t>0で明るく。 */
export function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 0xff
  let g = (n >> 8) & 0xff
  let b = n & 0xff
  if (t >= 0) {
    r = r + (255 - r) * t
    g = g + (255 - g) * t
    b = b + (255 - b) * t
  } else {
    const k = 1 + t
    r *= k
    g *= k
    b *= k
  }
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${((to(r) << 16) | (to(g) << 8) | to(b)).toString(16).padStart(6, '0')}`
}

/** 塗りつぶした楕円（走査線ごとに矩形で塗る＝ピクセル整合）。 */
export function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  ctx.fillStyle = color
  for (let dy = -ry; dy <= ry; dy++) {
    const t = dy / ry
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)))
    if (w <= 0) continue
    ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 1)
  }
}

/** 輪郭つき楕円。 */
export function ellipseOutlined(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
  outline: string,
): void {
  ellipse(ctx, cx, cy, rx + 1, ry + 1, outline)
  ellipse(ctx, cx, cy, rx, ry, fill)
}
