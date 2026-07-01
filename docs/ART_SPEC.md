# ART_SPEC — ドット絵の不変仕様

一度決めたら変更しない。ここを変えると全アセット・全レイアウトが崩れる。
（実装は `src/core/constants.ts` に集約。）

## 画面
- 論理解像度: 幅 **360固定**、高さは端末比率に追従して **640〜800** にクランプ。
- 整数倍率＋レターボックス（Phaser Scale.FIT / CENTER_BOTH）。
- `pixelArt: true` / `roundPixels: true` / `antialias: false`。描画座標は整数に丸める。
- 自由回転・非整数拡縮・ぼかしは禁止。

## タイル / キャラ
- タイル **32×32**。
- キャラフレーム **96×96**、足元基準点 **(48,84)**（=originX 0.5 / originY 0.875）。

## ポーズアトラス
- 1枚 **384×1728px** ＝ 横4列 × 縦18行。
- 行の並び: `down[idle2,walk4,attack4,cast4,hurt2,death4]` → `up`同順 → `left`同順。
- `right` は `left` を `setFlipX(true)`。`frameIndex = 行番号*4 + フレーム番号`。
- アニメ: idle 2f/3fps loop, walk 4f/8fps loop, attack 4f/14fps, cast 4f/10fps,
  hurt 2f/8fps, death 4f/8fps。

## 見た目方針
- プレイヤーの見た目は **職業固定**方式。装備は性能のみ変える（見た目に反映しない）。
  職業def の `appearance` → テクスチャキー。PNG が無い職はデフォルト素体にフォールバック。
- 敵・NPC・ペットは完成済み単一スプライト（レイヤー合成しない）。
- 「そこまで荒くないドット感」: 細かめのピクセル＋1px前後のクリーンな輪郭＋
  控えめなセルシェード（面ごとに明暗2〜3段）。ディザは控えめ。

## Phaser 4 の注意（前作の地雷）
- 白フラッシュは `sprite.setTint(color).setTintMode(Phaser.TintModes.FILL)`（`setTintFill` は無い）。
- flipX＋サブピクセル座標でフレームが欠ける → 物理ボディ（小数）と描画スプライト（整数スナップ）を分離。
- 日本語 wordWrap は `wordWrap: { width, useAdvancedWrap: true }` 必須。
- マルチタッチは `input.activePointers: 4`。
- フォントは `document.fonts.load` を待ってから `new Phaser.Game`（タイムアウト1.5s）。
- スクロールUIはジオメトリマスクを避け、不透明バーで覆う。
- アセットURLは `import.meta.env.BASE_URL` を前置（GitHub Pages サブパス配信）。
