import { dayToIso } from "./clock";
import { validateWorld } from "./world";
import type { WorldState } from "./types";

export const SAVE_VERSION = 1;

export interface SaveMeta {
  slot: string;
  savedAt: string; // 実時間 ISO
  scenarioName: string;
  gameDate: string;
  playTimeMs: number;
  difficulty: string;
}

export interface SaveFile {
  version: number;
  meta: SaveMeta;
  checksum: string;
  /** WorldState の JSON 文字列(チェックサム対象) */
  data: string;
}

/** FNV-1a 32bit。改ざん検出ではなく破損検出用。 */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function serialize(world: WorldState, slot: string, now = new Date()): SaveFile {
  const data = JSON.stringify(world);
  return {
    version: SAVE_VERSION,
    meta: {
      slot,
      savedAt: now.toISOString(),
      scenarioName: world.country.name,
      gameDate: dayToIso(world.clock.startDate, world.clock.day),
      playTimeMs: world.playTimeMs,
      difficulty: world.settings.difficulty,
    },
    checksum: checksum(data),
    data,
  };
}

export type LoadResult =
  | { ok: true; world: WorldState; warnings: string[] }
  | { ok: false; error: string };

/** バージョン間の移行。v1→v2 以降はここに追加する。 */
const MIGRATIONS: Record<number, (w: any) => any> = {};

export function deserialize(file: unknown): LoadResult {
  if (!file || typeof file !== "object") return { ok: false, error: "セーブデータの形式が不正です" };
  const f = file as Partial<SaveFile>;
  if (typeof f.version !== "number" || typeof f.data !== "string" || typeof f.checksum !== "string") {
    return { ok: false, error: "セーブデータの必須項目が欠けています" };
  }
  if (f.version > SAVE_VERSION) {
    return { ok: false, error: `新しいバージョン(v${f.version})のセーブです。本ゲームは v${SAVE_VERSION} までに対応しています` };
  }
  if (checksum(f.data) !== f.checksum) {
    return { ok: false, error: "チェックサムが一致しません(データ破損の可能性)" };
  }
  let world: any;
  try {
    world = JSON.parse(f.data);
  } catch {
    return { ok: false, error: "セーブデータを解析できません" };
  }
  for (let v = f.version; v < SAVE_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (!m) return { ok: false, error: `v${v} からの移行手順がありません` };
    world = m(world);
  }
  const errs = validateWorld(world as WorldState);
  if (errs.length > 0) return { ok: false, error: "整合性エラー: " + errs.slice(0, 3).join(" / ") };
  return { ok: true, world: world as WorldState, warnings: [] };
}

/** 保存先の抽象化(IndexedDB / メモリ / 将来のファイル)。 */
export interface SaveStorage {
  put(key: string, file: SaveFile): Promise<void>;
  get(key: string): Promise<SaveFile | undefined>;
  delete(key: string): Promise<void>;
  list(): Promise<SaveMeta[]>;
}

export class MemoryStorage implements SaveStorage {
  private m = new Map<string, SaveFile>();
  async put(key: string, file: SaveFile) { this.m.set(key, structuredClone(file)); }
  async get(key: string) { const v = this.m.get(key); return v ? structuredClone(v) : undefined; }
  async delete(key: string) { this.m.delete(key); }
  async list() { return [...this.m.entries()].filter(([k]) => !k.endsWith(".bak")).map(([, v]) => v.meta); }
}

/**
 * 保存・読み込みの窓口。
 * 上書き前に直前のセーブを `<slot>.bak` に退避し、ロードに失敗したらバックアップから復旧を試みる。
 */
export class SaveManager {
  constructor(private storage: SaveStorage) {}

  async save(world: WorldState, slot: string): Promise<SaveMeta> {
    const prev = await this.storage.get(slot);
    if (prev) await this.storage.put(slot + ".bak", { ...prev, meta: { ...prev.meta, slot: slot + ".bak" } });
    const file = serialize(world, slot);
    await this.storage.put(slot, file);
    return file.meta;
  }

  async load(slot: string): Promise<LoadResult> {
    const file = await this.storage.get(slot);
    if (!file) return { ok: false, error: "セーブデータが見つかりません" };
    const r = deserialize(file);
    if (r.ok) return r;
    const bak = await this.storage.get(slot + ".bak");
    if (bak) {
      const rb = deserialize(bak);
      if (rb.ok) return { ok: true, world: rb.world, warnings: [`${r.error}。バックアップから復旧しました`] };
    }
    return r;
  }

  list(): Promise<SaveMeta[]> {
    return this.storage.list();
  }
  async remove(slot: string): Promise<void> {
    await this.storage.delete(slot);
    await this.storage.delete(slot + ".bak");
  }
}

/** ブラウザ用 IndexedDB 実装。engine 単体テストでは使わない。 */
export class IndexedDbStorage implements SaveStorage {
  private dbp: Promise<IDBDatabase> | null = null;
  constructor(private dbName = "psim-saves") {}

  private db(): Promise<IDBDatabase> {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => req.result.createObjectStore("saves");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbp;
  }
  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const req = fn(db.transaction("saves", mode).objectStore("saves"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async put(key: string, file: SaveFile) { await this.tx("readwrite", (s) => s.put(file, key)); }
  async get(key: string) { return (await this.tx("readonly", (s) => s.get(key))) as SaveFile | undefined; }
  async delete(key: string) { await this.tx("readwrite", (s) => s.delete(key)); }
  async list() {
    const all = (await this.tx("readonly", (s) => s.getAll())) as SaveFile[];
    return all.map((f) => f.meta).filter((m) => !m.slot.endsWith(".bak"));
  }
}
