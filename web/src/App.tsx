import { useEffect, useMemo, useRef, useState } from "react";
import {
  GameEngine, IndexedDbStorage, SaveManager, createWorld, nationalSupport,
  type EventCategory,
} from "@psim/engine";

const SPEEDS: [string, number][] = [["通常", 1], ["高速", 7], ["超高速", 30]];
const CATEGORIES: [EventCategory, string][] = [
  ["election", "選挙"], ["economy", "経済"], ["politics", "政治"],
  ["diplomacy", "外交"], ["disaster", "災害"], ["scandal", "不祥事"],
];

export function App() {
  const engine = useRef<GameEngine>();
  if (!engine.current) engine.current = new GameEngine(createWorld({ playerPartyId: "rikken" }));
  const e = engine.current;
  const saves = useMemo(() => new SaveManager(new IndexedDbStorage()), []);

  const [, force] = useState(0);
  const [selected, setSelected] = useState<string | null>("tokyo");
  const [message, setMessage] = useState("");

  // 描画フレームとは独立に、実経過時間(ms)をエンジンへ渡す
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - last, 250); // タブ復帰時の巨大dtを抑える
      last = now;
      if (e.tick(dt) > 0 || e.paused) force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [e]);

  const w = e.world;
  const parties = Object.values(w.parties);
  const regions = Object.values(w.regions);
  const autoPause = new Set(w.settings.autoPauseCategories);

  const refresh = () => force((n) => n + 1);

  async function doSave() {
    try {
      const m = await saves.save(w, "slot1");
      setMessage(`保存しました(${m.gameDate})`);
    } catch (err) { setMessage("保存に失敗: " + String(err)); }
  }
  async function doLoad() {
    const r = await saves.load("slot1");
    if (!r.ok) { setMessage("ロード失敗: " + r.error); return; }
    e.setPaused(true);
    e.replaceWorld(r.world);
    setMessage(r.warnings[0] ?? "ロードしました");
    refresh();
  }

  const sel = selected ? w.regions[selected] : null;

  return (
    <div>
      <div className="top">
        <span className="date">{e.dateIso}</span>
        <button className={e.paused ? "on" : ""} onClick={() => { e.setPaused(!e.paused); refresh(); }}>
          {e.paused ? "▶ 再開" : "⏸ 一時停止"}
        </button>
        {SPEEDS.map(([label, v]) => (
          <button key={label} className={e.speed === v ? "on" : ""} onClick={() => { e.setSpeed(v); refresh(); }}>{label}</button>
        ))}
        <label>
          倍率 {e.speed.toFixed(1)}日/秒{" "}
          <input type="range" min="0.5" max="120" step="0.5" value={e.speed}
            onChange={(ev) => { e.setSpeed(Number(ev.target.value)); refresh(); }} />
        </label>
        <button onClick={() => { e.runDays(1); refresh(); }}>+1日</button>
        <button onClick={() => { e.runDays(30); refresh(); }}>+30日</button>
        <span style={{ marginLeft: "auto" }} />
        <button onClick={doSave}>保存</button>
        <button onClick={doLoad}>ロード</button>
        <span className="msg">{message}</span>
      </div>

      <div className="main">
        <div className="card">
          <h2>地域別支持率(%)</h2>
          <div className="scroll">
            <table>
              <thead>
                <tr><th>地域</th><th>人口(千)</th>{parties.map((p) => <th key={p.id} style={{ color: p.color }}>{p.name}</th>)}</tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r.id} className={selected === r.id ? "sel" : ""} onClick={() => setSelected(r.id)}>
                    <td>{r.name}</td>
                    <td>{Math.round(r.population)}</td>
                    {parties.map((p) => <td key={p.id}>{(w.support[r.id]?.[p.id] ?? 0).toFixed(1)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <h2>全国(人口加重)</h2>
            {parties.map((p) => {
              const v = nationalSupport(w, p.id);
              return (
                <div key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: p.color }}>{p.name}{p.isPlayer ? "(あなた)" : ""}</span>
                    <b>{v.toFixed(1)}%</b>
                  </div>
                  <div className="bar"><div style={{ width: `${v * 2}%`, background: p.color }} /></div>
                </div>
              );
            })}
          </div>

          {sel && (
            <div className="card">
              <h2>{sel.name}</h2>
              <div>ブロック: {w.blocks.find((b) => b.id === sel.blockId)?.name}</div>
              <div>小選挙区: {sel.smdSeats}</div>
              <div>思想(経済/外交/社会): {sel.ideology.econ} / {sel.ideology.diplo} / {sel.ideology.social}</div>
            </div>
          )}

          <div className="card">
            <h2>自動停止するイベント</h2>
            {CATEGORIES.map(([c, label]) => (
              <label key={c} style={{ marginRight: 10 }}>
                <input type="checkbox" checked={autoPause.has(c)}
                  onChange={(ev) => {
                    const next = new Set(autoPause);
                    ev.target.checked ? next.add(c) : next.delete(c);
                    e.setAutoPause([...next]);
                    refresh();
                  }} /> {label}
              </label>
            ))}
          </div>

          <div className="card">
            <h2>イベント履歴</h2>
            <div className="log">
              {w.eventHistory.length === 0 && <div>まだ発生していません</div>}
              {[...w.eventHistory].reverse().slice(0, 12).map((h) => (
                <div key={h.id}>{h.day}日目: {h.title}</div>
              ))}
            </div>
            <div style={{ marginTop: 8, color: "#6b7280" }}>
              次の予定: {w.scheduler.queue[0] ? `${w.scheduler.queue[0].day}日目 ${w.scheduler.queue[0].title}` : "なし"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
