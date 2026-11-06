import { describe, expect, it } from "vitest";
import {
  GameEngine, MemoryStorage, SaveManager, createWorld, deserialize, serialize,
  nationalSupport, validateWorld, dayToIso, isoToDay, Rng,
} from "../src";

const fresh = (seed = 1) => new GameEngine(createWorld({ seed, playerPartyId: "rikken" }));

describe("テンプレート", () => {
  it("47都道府県・11ブロック・議席合計が旧ゲームと一致する", () => {
    const w = createWorld();
    expect(Object.keys(w.regions)).toHaveLength(47);
    expect(w.blocks).toHaveLength(11);
    expect(w.country.election.smdSeats).toBe(289);
    expect(w.country.election.prSeats).toBe(176);
    expect(w.country.election.majority).toBe(233);
    expect(validateWorld(w)).toEqual([]);
  });
  it("同じシードなら同じ世界、違えば違う世界", () => {
    expect(JSON.stringify(createWorld({ seed: 5 }))).toBe(JSON.stringify(createWorld({ seed: 5 })));
    expect(JSON.stringify(createWorld({ seed: 5 }))).not.toBe(JSON.stringify(createWorld({ seed: 6 })));
  });
  it("議席数の不整合を検出する", () => {
    const w = createWorld();
    w.country.election.smdSeats = 300;
    expect(validateWorld(w).length).toBeGreaterThan(0);
  });
});

describe("時間", () => {
  it("一時停止中は進まない", () => {
    const e = fresh();
    e.setSpeed(10);
    expect(e.tick(5000)).toBe(0);
    expect(e.day).toBe(0);
  });
  it("速度に応じて進み、フレーム分割に依存しない", () => {
    const a = fresh(); const b = fresh();
    for (const e of [a, b]) { e.setSpeed(10); e.setPaused(false); }
    a.tick(1000);
    for (let i = 0; i < 60; i++) b.tick(1000 / 60);
    expect(a.day).toBe(10);
    expect(Math.abs(b.day - 10)).toBeLessThanOrEqual(1);
    // 同じ日数なら状態は完全一致(同日を二重処理しない)
    const c = fresh(); c.runDays(b.day);
    expect(JSON.stringify(c.world.support)).toBe(JSON.stringify(b.world.support));
  });
  it("速度変更が反映される", () => {
    const e = fresh(); e.setPaused(false);
    e.setSpeed(2); e.tick(1000);
    e.setSpeed(30); e.tick(1000);
    expect(e.day).toBe(32);
  });
  it("日付変換が往復する", () => {
    expect(dayToIso("2027-01-01", 59)).toBe("2027-03-01");
    expect(isoToDay("2027-01-01", "2028-01-01")).toBe(365);
  });
});

describe("イベント", () => {
  it("指定日に1回だけ発生し、履歴に残る", () => {
    const e = fresh(); const seen: number[] = [];
    e.onEvent((ev) => seen.push(ev.day));
    e.schedule({ day: 5, kind: "t", category: "economy", title: "テスト", important: false });
    e.runDays(10);
    expect(seen).toEqual([5]);
    expect(e.world.eventHistory.filter((h) => h.kind === "t")).toHaveLength(1);
  });
  it("同日のイベントは登録順に処理される", () => {
    const e = fresh(); const order: string[] = [];
    e.onEvent((ev) => order.push(ev.kind));
    e.schedule({ day: 3, kind: "b", category: "system", title: "b", important: false });
    e.schedule({ day: 3, kind: "c", category: "system", title: "c", important: false });
    e.schedule({ day: 2, kind: "a", category: "system", title: "a", important: false });
    e.runDays(3);
    expect(order).toEqual(["a", "b", "c"]);
  });
  it("対象カテゴリの重要イベントで自動停止する(対象外では止まらない)", () => {
    const e = fresh(); e.setPaused(false); e.setSpeed(100);
    e.setAutoPause(["disaster"]);
    e.schedule({ day: 4, kind: "x", category: "economy", title: "x", important: true });
    e.schedule({ day: 8, kind: "y", category: "disaster", title: "y", important: true });
    e.tick(1000);
    expect(e.paused).toBe(true);
    expect(e.day).toBe(8);
  });
  it("任期満了日に総選挙イベントが発生し、選挙カテゴリで自動停止する", () => {
    const e = fresh(); e.setPaused(false); e.setSpeed(3650);
    // 1フレームの処理日数には上限(暴走防止)があるため、停止するまでフレームを重ねる
    for (let i = 0; i < 20 && !e.paused; i++) e.tick(1000);
    expect(e.paused).toBe(true);
    expect(e.day).toBe(e.world.country.election.termDays);
    expect(e.world.eventHistory.some((h) => h.kind === "general_election_due")).toBe(true);
  });
});

describe("世界の進行", () => {
  it("1年進めても支持率・人口が有効範囲に収まる(整合性)", () => {
    const e = fresh(3);
    e.runDays(365);
    expect(validateWorld(e.world)).toEqual([]);
    for (const p of Object.keys(e.world.parties)) {
      const n = nationalSupport(e.world, p);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(90);
    }
  });
  it("時間経過で支持率が実際に変化する", () => {
    const e = fresh(3);
    const before = JSON.stringify(e.world.support);
    e.runDays(30);
    expect(JSON.stringify(e.world.support)).not.toBe(before);
  });
  it("難易度で変動幅が変わる", () => {
    const spread = (d: "casual" | "hard") => {
      const e = new GameEngine(createWorld({ seed: 9, difficulty: d }));
      const start = nationalSupport(e.world, "jimin");
      let max = 0;
      for (let i = 0; i < 300; i++) { e.runDays(1); max = Math.max(max, Math.abs(nationalSupport(e.world, "jimin") - start)); }
      return max;
    };
    expect(spread("hard")).toBeGreaterThan(spread("casual"));
  });
});

describe("乱数", () => {
  it("状態を復元すれば同じ列を再現する", () => {
    const r = new Rng(42); r.next(); r.next();
    const s = r.state; const a = [r.next(), r.next()];
    r.setState(s);
    expect([r.next(), r.next()]).toEqual(a);
  });
});

describe("セーブ・ロード", () => {
  it("保存→ロード後、続きの進行が完全に一致する(決定論)", async () => {
    const e = fresh(7); e.runDays(100);
    const mgr = new SaveManager(new MemoryStorage());
    await mgr.save(e.world, "slot1");
    const r = await mgr.load("slot1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e2 = new GameEngine(r.world);
    e.runDays(200); e2.runDays(200);
    expect(JSON.stringify(e2.world)).toBe(JSON.stringify(e.world));
  });
  it("メタ情報(日付・シナリオ名・難易度)が保存される", async () => {
    const e = fresh(); e.runDays(59);
    const f = serialize(e.world, "s");
    expect(f.meta.gameDate).toBe("2027-03-01");
    expect(f.meta.scenarioName).toBe("日本(架空)");
  });
  it("破損データを検出する", () => {
    const f = serialize(fresh().world, "s");
    f.data = f.data.replace("日本", "日木");
    const r = deserialize(f);
    expect(r.ok).toBe(false);
  });
  it("未来バージョンのセーブを拒否する", () => {
    const f = serialize(fresh().world, "s");
    expect(deserialize({ ...f, version: 99 }).ok).toBe(false);
  });
  it("本体が壊れていてもバックアップから復旧する", async () => {
    const st = new MemoryStorage(); const mgr = new SaveManager(st);
    const e = fresh(); e.runDays(10);
    await mgr.save(e.world, "s");
    e.runDays(10);
    await mgr.save(e.world, "s"); // 1回目が .bak に退避される
    const cur = await st.get("s");
    await st.put("s", { ...cur!, data: cur!.data + " " });
    const r = await mgr.load("s");
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.world.clock.day).toBe(10); expect(r.warnings.length).toBe(1); }
  });
  it("削除でスロットとバックアップが消え、一覧にバックアップは出ない", async () => {
    const mgr = new SaveManager(new MemoryStorage());
    await mgr.save(fresh().world, "a"); await mgr.save(fresh().world, "a");
    expect(await mgr.list()).toHaveLength(1);
    await mgr.remove("a");
    expect(await mgr.list()).toHaveLength(0);
  });
});

describe("長期プレイ", () => {
  it("20年(7300日)ヘッドレスで回しても破綻せず、保存できる", () => {
    const e = fresh(11);
    e.runDays(365 * 20);
    expect(validateWorld(e.world)).toEqual([]);
    expect(serialize(e.world, "long").data.length).toBeLessThan(5_000_000);
  });
});
