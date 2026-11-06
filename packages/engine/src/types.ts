export type RegionId = string;
export type PartyId = string;
export type BlockId = string;
export type PoliticianId = string;

export interface Ideology {
  econ: number; // -100(財政出動・格差是正) .. +100(構造改革・緊縮)
  diplo: number; // -100(リベラル・対話) .. +100(保守・防衛強化)
  social: number; // -100(進歩) .. +100(伝統)
}

export interface Block {
  id: BlockId;
  name: string;
  prSeats: number;
}

export interface Region {
  id: RegionId;
  name: string;
  blockId: BlockId;
  /** 小選挙区の定数 */
  smdSeats: number;
  /** 人口(千人) */
  population: number;
  ideology: Ideology;
}

export interface Party {
  id: PartyId;
  name: string;
  color: string;
  ideology: Ideology;
  funds: number; // 万円
  /** 全国知名度 0-100 */
  fame: number;
  leaderId: PoliticianId | null;
  isPlayer: boolean;
}

export interface Politician {
  id: PoliticianId;
  name: string;
  age: number;
  partyId: PartyId | null;
  regionId: RegionId | null;
  ideology: Ideology;
}

export interface ElectionSystemConfig {
  kind: "parallel"; // 並立制(Phase 2 で他制度を追加)
  smdSeats: number;
  prSeats: number;
  majority: number;
  termDays: number;
}

export interface Country {
  name: string;
  startDate: string; // ISO yyyy-mm-dd
  election: ElectionSystemConfig;
}

export interface Clock {
  /** 開始日からの経過日数(整数、単調増加) */
  day: number;
  startDate: string;
}

export type EventCategory =
  | "politics" | "economy" | "society" | "diplomacy"
  | "election" | "parliament" | "disaster" | "scandal" | "system";

export interface ScheduledEvent {
  id: number;
  day: number;
  kind: string;
  category: EventCategory;
  title: string;
  /** 発生時に自動停止するか */
  important: boolean;
  payload?: Record<string, unknown>;
}

export interface EventRecord {
  id: number;
  day: number;
  kind: string;
  category: EventCategory;
  title: string;
}

export type Difficulty = "casual" | "standard" | "real" | "hard";

export interface Settings {
  difficulty: Difficulty;
  /** 自動停止の対象カテゴリ */
  autoPauseCategories: EventCategory[];
}

export interface WorldState {
  seed: number;
  rngState: number;
  clock: Clock;
  country: Country;
  blocks: Block[];
  regions: Record<RegionId, Region>;
  parties: Record<PartyId, Party>;
  politicians: Record<PoliticianId, Politician>;
  /** 地域×政党の支持率(%)。支持率の唯一の保存場所。全国値などは派生計算する */
  support: Record<RegionId, Record<PartyId, number>>;
  scheduler: { nextId: number; queue: ScheduledEvent[] };
  eventHistory: EventRecord[];
  aiLog: { day: number; actor: string; text: string }[];
  settings: Settings;
  playerPartyId: PartyId | null;
  playTimeMs: number;
}
