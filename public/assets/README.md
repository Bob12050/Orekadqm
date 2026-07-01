# アセットの差し替え方法

このゲームは起動時に**プロシージャルなプレースホルダー**を生成します。
実PNGを置いて `manifest.json` に登録すると、そのキーだけ自動で上書きされます
（コード変更は不要）。

## キャラクター（職業）
- 配置: `char/<appearance>.png`（例: `char/char_warrior.png`）
- サイズ: **384 × 1728px**（横4列 × 縦18行、1フレーム 96×96）
- 行の並び: `down[idle2,walk4,attack4,cast4,hurt2,death4]` → `up`同順 → `left`同順
  （`right` は実行時に左右反転）
- `manifest.json` の `chars` に `appearance` キー（`src/data/defs/jobs.json` の `appearance`）を追加。

## 敵
- 配置: `enemy/<sprite>.png`（例: `enemy/slime.png`）
- 単一スプライト（アニメ無し）。足元が画像下端に来るように。
- `manifest.json` の `enemies` に `sprite` キー（`src/data/defs/enemies.json` の `visual.sprite`）を追加。

## フォント
- `fonts/dotgothic16.woff2` を置き、`index.html` の `@font-face` を有効化すると
  日本語ドットフォントを自己ホストできます（未配置時はオンラインのDotGothic16→monospaceにフォールバック）。
