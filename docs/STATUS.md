# STATUS — 実装状況

2026-07 時点 / Phase 0 完了。

## 実装済み
- 基盤: Phaser 4.2.0 / TS6 strict(any禁止) / Vite 8 / Vitest 4 / vite-plugin-pwa 1。
- 画面: 論理360×(640-800)、pixelArt・整数丸め、Scale.FIT、safe-area配慮の操作UI。
- コア（純TS・テスト対象）: EventBus / computeDerived / elements / drops(seedable) /
  leveling / equipment / crafting / supply / quests / save(IndexedDB, instances確保)。
- データ: items7 / equipment14 / jobs5 / skills4 / enemies4(ボス1) / dropTables4 /
  maps3(町/野/アリーナ) / recipes4 / quests3。
- 生成: プロシージャル・プレースホルダー（職業アトラス5＋素体 / 敵4形状 / 地面・装飾 /
  操作UI / アイテム・装備アイコン）。実PNGを manifest 登録で自動上書き。
- 実行: タイトル→職業選択→ワールド（移動/攻撃/スキル/被弾/敵AI chase・wander /
  ドロップ吸着回収 / クエスト進行 / 出口遷移 / オートセーブ / 死亡→町帰還）。
- 音: WebAudio 合成SE 12種（unlock/suspend/レート制限/ON/OFF localStorage）。
- 検証: typecheck / validate-data / build / Vitest 22件（7ファイル）。
- ヘッドレス起動スモーク（Chromium swiftshader）で Boot→Title→World を確認済み。

## 未実装（今後のフェーズ）
- ボス行動パターン（予告→範囲/突進/弾幕/召喚/怒り）… Phase 1
- スキル個別効果の本実装（buff/summon）、スキルツリーUI … Phase 1
- 看板ボス12体・★ランク1-7・装飾ライン・ペット・2次職以降・敵固有絵 … Phase 2
- エンドゲーム（調査クエスト・ランダム性能 ItemInstance・分解/強化） … Phase 3
- BGM。日本語ドットフォントの自己ホスト woff2（現状オンライン→monospaceフォールバック）。

## 既知の割り切り（Phase 0）
- 盾は `back` スロット装備。weaponTag 制限は weapon スロットのみ適用。
- マップ遷移後は常に開始マップの中央スポーン（進入位置の引き継ぎは未実装）。
- 敵の湧きは最大12体で打ち切り（`log` 相当の割り切り）。
