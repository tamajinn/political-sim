# CHANGELOG

## 0.1.0 — Phase 1(2026-11-04)
### 追加
- monorepo(npm workspaces): `packages/engine`, `apps/web`
- エンジン: GameEngine(固定ステップ1日・速度・一時停止・自動停止)、Rng、スケジューラ、WorldState、`createWorld`/`validateWorld`
- 架空日本テンプレート(47地域・11ブロック・3党・議席465)
- 暫定システム: opinion、population
- セーブ: シリアライズ、チェックサム、バージョン、`.bak` 復旧、Memory/IndexedDB ストレージ
- テスト22件(`packages/engine/tests/engine.test.ts`)
- 最小UI(時間操作・地域別支持率表・自動停止設定・イベント履歴・保存/ロード)
- docs 6種
### 保存
- `legacy/election-sim-v2.html` に旧ゲームを保存(変更なし)
