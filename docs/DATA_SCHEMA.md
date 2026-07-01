# DATA_SCHEMA — データ定義スキーマ

全データは `src/data/defs/*.json` に配列で置き、不変の文字列 `id` で相互参照する。
型は `src/data/types.ts`。`npm run validate-data` が ID重複・参照切れ・範囲外値・
素材入手可能性を検査し、問題があれば非0で落ちる。

| ファイル | 型 | 主な参照先 |
|---|---|---|
| `items.json` | `ItemDef` | — |
| `equipment.json` | `EquipmentDef` | element, weaponTag, slot, rarity(R1-10) |
| `jobs.json` | `JobDef` | weaponTags, appearance(テクスチャキー) |
| `skills.json` | `SkillDef` | prereq(→skill, 循環禁止), element, effect型 |
| `enemies.json` | `EnemyDef` | element/weakness/resist, dropTable(→dropTables) |
| `dropTables.json` | `DropTableDef` | entries.itemId / guaranteedFirst(→items|equipment) |
| `maps.json` | `MapDef` | spawns.enemy(→enemies), exits.toMap(→maps) |
| `recipes.json` | `RecipeDef` | output/upgradeFrom(→equipment), materials(→items) |
| `quests.json` | `QuestDef` | targetEnemy(→enemies), map(→maps), rewardItems |

## 検証ルール（validate-data）
- ドロップ→アイテム/装備、レシピ→素材、クエスト→敵/マップ、マップ→敵/出口、スキル前提の存在。
- スキル前提の循環検出。
- 範囲: rank 1-7, rarity R1-10, job tier 1-4, element/weakness/resist は既知の属性のみ。
- 素材入手可能性: 全レシピ素材が「ドロップ or 他レシピ産出」で入手可能か（`src/crafting/supply.ts`）。

## セーブスキーマ（`src/save/schema.ts`）
- `version` 付き。`migrate()` で旧版を移行。
- `player`（職業/レベル/EXP/HP/MP/base/習得スキル）、`equipped`(9スロット)、
  `ownedEquipment`、`inventory`、`quests`、`killedBosses`、`settings`。
- `instances: ItemInstance[]` … ランダム性能の装備個体。Phase 0 では空だが**初日から確保**。
- 永続化は IndexedDB（`src/save/db.ts`）。Service Worker キャッシュには入れない。

## データを増やすときの心得（前作の学び）
- テストは総数一致ではなく「〜以上」や性質検証（全レシピ素材が入手可能 等）で書く。
- 総数一致は意図的な棚卸しのときだけ使う。
