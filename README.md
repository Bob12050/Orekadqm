# Orekadqm

モバイル縦画面専用の PWA アクションRPG。チョコットランド風のかわいいドット絵を土台に、
モンスターハンター風の「狩猟クエスト→ボス素材収集→専用武器クラフト」ループを核にする。
（既存作品の名称・キャラ・素材・固有デザインは模倣しないオリジナル。）

現在は **Phase 0（基盤縦切り）** が完成: 起動 → タイトル → 職業選択 → 町 → フィールド →
敵討伐 → ドロップ → 装備 → クラフト → クエスト → セーブ → PWA、＋合成SE＋検証ツール。

## 技術スタック
Phaser 4.2.0 / TypeScript 6（strict, any禁止）/ Vite 8 / Vitest 4 / vite-plugin-pwa 1。
セーブは IndexedDB（Service Worker キャッシュに入れない）。

## 開発
```bash
npm install
npm run dev            # 開発サーバ
npm run typecheck      # strict 型検査
npm run validate-data  # データ整合の自作バリデータ
npm run test           # 純ロジックの Vitest
npm run build          # 本番ビルド（tsc + vite + PWA）
```
変更のたびに typecheck / validate-data / test / build の4点を通すこと。

## 画面・操作
- 論理解像度 幅360固定・高さ640〜800クランプ、整数倍率＋レターボックス、pixelArt。
- 仮想スティック（画面左）＋攻撃 / スキル / 調べる ボタン（画面右）。マルチタッチ対応。
- 横画面ではポーズ＋警告オーバーレイ。タブ非表示で自動保存。

## アセットの差し替え
プロシージャル・プレースホルダーを起動時に生成する。実PNGを `public/assets/` に置き
`public/assets/manifest.json` に登録すると、そのキーだけ自動で上書きされる（コード変更不要）。
詳細は [`public/assets/README.md`](public/assets/README.md)。

## ドキュメント
- [docs/ROADMAP.md](docs/ROADMAP.md) — フェーズと完了条件
- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — ゲームシステム仕様
- [docs/ART_SPEC.md](docs/ART_SPEC.md) — ドット絵の不変仕様
- [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) — データ定義スキーマ
- [docs/STATUS.md](docs/STATUS.md) — 現在の実装状況
- [docs/REMAKE_KIT.md](docs/REMAKE_KIT.md) — 元となった開発キット（参照資料）
