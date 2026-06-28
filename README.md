# モンスター育成・配合バトルRPG 設計プロジェクト

スマホ向け（PWA 先行 → 将来ネイティブ化）モンスター育成・配合・スカウトバトル RPG の
完全オリジナル企画・設計リポジトリです。

> 参考イメージ（開発者向けの内部参照のみ）：アーケード型モンスター召喚バトル、王道モンスター配合RPG。
> 本設計はそれらの**魅力の構造だけ**を抽出し、名称・モンスター・技名・UI・世界観・固有システムは
> すべてオリジナルとして再設計しています。

## ドキュメント構成

| ファイル | 内容 |
| --- | --- |
| [`docs/game-design.md`](docs/game-design.md) | **メイン設計書**（全15章。コンセプト〜MVP〜ワイヤーフレーム） |
| [`docs/monsters.md`](docs/monsters.md) | 初期実装用モンスター30体の詳細設計 |
| [`docs/chapters.md`](docs/chapters.md) | 全10章のストーリー・進行・ボス設計 |
| [`data/monsters.json`](data/monsters.json) | モンスター30体の機械可読データ（MVP実装用） |
| [`data/fusion_rules.json`](data/fusion_rules.json) | 配合ルール（汎用・特殊）の機械可読データ |
| [`data/chapters.json`](data/chapters.json) | 章・ステージ進行の機械可読データ |

## 仮タイトル案

1. **コドモナ・サーガ（KODOMONA SAGA）**
2. **ルーレットビースト（RouletteBeast）**
3. **きみとモンスターの星（Hoshi to Kemono）**
4. **アルカナ・タクティカ（ARCANA TACTICA）**
5. **ぐるぐるバトル ピクシーズ（GuruGuru Pixies）**

## 一言コンセプト

> **「タップとルーレットだけで、本格モンスター配合RPGが手のひらに」**

## 開発フェーズ

- **Phase 0 — MVP（PWA）**：1章 / モンスター12体 / 4対4ルーレットバトル / スカウト / 簡易配合 / 図鑑
- **Phase 1**：2〜3章解放、特殊配合、図鑑逆引き、サウンド強化
- **Phase 2**：全10章、性格・覚醒、クラウドセーブ
- **Phase 3**：ネイティブアプリ化（Capacitor / React Native ラップ）

詳細は [`docs/game-design.md`](docs/game-design.md) の「13. MVP設計」を参照してください。
