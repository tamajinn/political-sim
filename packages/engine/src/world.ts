import { Rng } from "./rng";
import { schedule } from "./scheduler";
import { BLOCKS, PARTY_TEMPLATES, REGIONS, ideologyMatch } from "./data/japan";
import type { Party, Politician, WorldState } from "./types";

const SURNAMES = ["田中", "佐藤", "鈴木", "高橋", "伊藤", "山田", "中村", "小林", "加藤", "吉田", "山口", "松本"];
const GIVEN = ["一郎", "花子", "次郎", "美咲", "太郎", "陽子", "健", "愛", "誠", "涼", "恵", "剛"];

export interface NewWorldOptions {
  seed?: number;
  playerPartyId?: string | null;
  difficulty?: WorldState["settings"]["difficulty"];
}

/** 架空日本テンプレートからワールドを生成する(同じシードなら同じ世界)。 */
export function createWorld(opts: NewWorldOptions = {}): WorldState {
  const seed = opts.seed ?? 20261104;
  const rng = new Rng(seed);

  const smdSeats = REGIONS.reduce((s, r) => s + r.smdSeats, 0);
  const prSeats = BLOCKS.reduce((s, b) => s + b.prSeats, 0);

  const parties: Record<string, Party> = {};
  const politicians: Record<string, Politician> = {};
  let pid = 1;

  for (const t of PARTY_TEMPLATES) {
    const leaderId = `pol${pid++}`;
    politicians[leaderId] = {
      id: leaderId,
      name: SURNAMES[rng.int(0, SURNAMES.length - 1)]! + GIVEN[rng.int(0, GIVEN.length - 1)]!,
      age: rng.int(48, 70),
      partyId: t.id,
      regionId: null,
      ideology: { ...t.ideology },
    };
    parties[t.id] = {
      id: t.id, name: t.name, color: t.color, ideology: { ...t.ideology },
      funds: t.funds, fame: t.fame, leaderId, isPlayer: t.id === opts.playerPartyId,
    };
  }

  // 初期支持率: 旧ゲームの相性ベース式を踏襲(相性×38+5+ゆらぎ)、ただし合計が90%を超えないよう正規化
  const support: WorldState["support"] = {};
  for (const r of REGIONS) {
    const raw: Record<string, number> = {};
    let total = 0;
    for (const p of Object.values(parties)) {
      const v = Math.max(2, ideologyMatch(p.ideology, r.ideology) * 38 + 5 + rng.range(-4, 4));
      raw[p.id] = v;
      total += v;
    }
    const scale = total > 90 ? 90 / total : 1;
    support[r.id] = {};
    for (const [id, v] of Object.entries(raw)) support[r.id]![id] = v * scale;
  }

  const startDate = "2027-01-01";
  const world: WorldState = {
    seed,
    rngState: rng.state,
    clock: { day: 0, startDate },
    country: {
      name: "日本(架空)",
      startDate,
      election: { kind: "parallel", smdSeats, prSeats, majority: Math.floor((smdSeats + prSeats) / 2) + 1, termDays: 365 * 4 },
    },
    blocks: BLOCKS.map((b) => ({ ...b })),
    regions: Object.fromEntries(REGIONS.map((r) => [r.id, { ...r, ideology: { ...r.ideology } }])),
    parties,
    politicians,
    support,
    scheduler: { nextId: 1, queue: [] },
    eventHistory: [],
    aiLog: [],
    settings: { difficulty: opts.difficulty ?? "standard", autoPauseCategories: ["election"] },
    playerPartyId: opts.playerPartyId ?? null,
    playTimeMs: 0,
  };

  // 総選挙は任期満了日にスケジュール(選挙の実計算は Phase 2)
  schedule(world, {
    day: world.country.election.termDays,
    kind: "general_election_due",
    category: "election",
    title: "衆議院総選挙の期日",
    important: true,
  });
  return world;
}

export function validateWorld(w: WorldState): string[] {
  const errs: string[] = [];
  const regions = Object.values(w.regions);
  const smd = regions.reduce((s, r) => s + r.smdSeats, 0);
  const pr = w.blocks.reduce((s, b) => s + b.prSeats, 0);
  if (smd !== w.country.election.smdSeats) errs.push(`小選挙区数の合計(${smd})が設定(${w.country.election.smdSeats})と一致しません`);
  if (pr !== w.country.election.prSeats) errs.push(`比例議席の合計(${pr})が設定(${w.country.election.prSeats})と一致しません`);
  const blockIds = new Set(w.blocks.map((b) => b.id));
  for (const r of regions) {
    if (!blockIds.has(r.blockId)) errs.push(`地域 ${r.id} のブロック ${r.blockId} が存在しません`);
    const s = w.support[r.id];
    if (!s) { errs.push(`地域 ${r.id} の支持率がありません`); continue; }
    let total = 0;
    for (const p of Object.keys(w.parties)) {
      const v = s[p];
      if (v === undefined || !Number.isFinite(v) || v < 0) errs.push(`地域 ${r.id} の政党 ${p} の支持率が不正です`);
      else total += v;
    }
    if (total > 100.0001) errs.push(`地域 ${r.id} の支持率合計が100%を超えています(${total.toFixed(1)})`);
  }
  for (const p of Object.values(w.parties)) {
    if (p.leaderId && !w.politicians[p.leaderId]) errs.push(`政党 ${p.id} の党首が存在しません`);
  }
  return errs;
}
