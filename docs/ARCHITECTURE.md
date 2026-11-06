# ARCHITECTURE

## 1. 構成
```
packages/engine/   UI非依存の純TypeScript。Node/bunだけで実行・テスト可能
  src/types.ts       WorldState と関連型(唯一の真実)
  src/rng.ts         シード付き乱数(mulberry32)。状態をセーブに含める
  src/clock.ts       日数⇔日付
  src/scheduler.ts   日付ベースのイベントキュー((day,id)昇順)
  src/engine.ts      GameEngine: 固定ステップ(1日)、速度、一時停止、自動停止
  src/systems/       日次システム(現在: opinion, population)
  src/world.ts       createWorld(seed) / validateWorld
  src/save.ts        serialize/deserialize/SaveManager/各Storage
  src/data/japan.ts  架空日本テンプレート(旧ゲームから移植)
  tests/             22テスト
apps/web/          React + Vite の最小UI(エンジンを購読するだけ)
docs/              引き継ぎ文書
legacy/            旧ゲーム(参照用。削除しない)
```

## 2. 設計原則
1. **データは WorldState に1箇所だけ**。政党支持率は `support[地域][政党]` のみ保存。全国値は `nationalSupport()` で派生計算する
2. **エンジンは描画から独立**。`tick(実経過ms)` が固定ステップ(1日)へ変換する。1フレームの処理日数に上限(366)があり、遅延は捨てる
3. **決定論**。乱数は `world.rngState` に保持。セーブ→ロード後の進行が完全一致することをテスト済み
4. **システムは `(world, rng, day) => void`**。`engine.addSystem()` で追加。実行順は配列順
5. **イベントは日付キュー**。同日は登録順。`important` かつ `autoPauseCategories` に含まれるカテゴリなら自動停止
6. **AI判断は将来 `DecisionMaker` インターフェース化**(Phase 2 で導入)。ログは `world.aiLog`

## 3. セーブ
- 形式: `{version, meta, checksum(FNV-1a), data(JSON文字列)}`
- 検証順: 形式 → version(未来版は拒否)→ チェックサム → JSON → 移行(`MIGRATIONS`)→ `validateWorld`
- 上書き前に `<slot>.bak` へ退避。ロード失敗時はバックアップから復旧し警告を返す
- 保存先は `SaveStorage` 抽象: `MemoryStorage`(テスト)/`IndexedDbStorage`(ブラウザ)。将来ファイル(Tauri)を追加

## 4. 技術選定の理由
TypeScript strict(大規模データの整合性)、Vite+React(既存資産・高速)、IndexedDB(長期プレイで容量が増える)、Vitest(エンジン検証)、Tauri(後フェーズ、軽量)。
地図は D3-geo+TopoJSON を予定(外部サービス不要でオフライン可)。

## 5. 暫定実装(置き換え予定)
- `opinionSystem`: 思想相性ベースの基準値への平均回帰 + ランダムウォーク。**経済・イベントと未連動**。Phase 2 で国民集団モデルに置換
- `populationSystem`: 年0.1%減の単純な変動。Phase 3 で人口動態に置換

## 6. 旧ゲームの問題点(作り直し対象)
票計算が支持率の擬似按分 / 比例176議席への強制補正 / PollingModal が議席計算を独自再実装 / ネット広告の説明文のテンプレートリテラル誤り(`"-${nextCost}..."`)と disabled 条件(60万円固定)のずれ / 党員採用費の表示(100万円)と実費(50万円)の不一致 / ライバル支持率上限30の固定 / 乱数がグローバル `Math.random`。
