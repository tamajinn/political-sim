import { dayToIso } from "./clock";
import { Rng } from "./rng";
import { popDue, schedule, type NewEvent } from "./scheduler";
import { opinionSystem, populationSystem } from "./systems/opinion";
import type { EventCategory, ScheduledEvent, WorldState } from "./types";

export type System = (world: WorldState, rng: Rng, day: number) => void;
export type EngineListener = (ev: ScheduledEvent) => void;

const MAX_STEPS_PER_TICK = 366;

/**
 * UI非依存のゲームエンジン。
 * - 内部時間は整数の「日」。描画フレームとは独立し、tick(実経過ms)で固定ステップ化する。
 * - 1日の処理は stepDay() に集約され、同じ日を二重に処理しない。
 */
export class GameEngine {
  world: WorldState;
  /** 1実秒あたりに進むゲーム内日数 */
  speed = 1;
  paused = true;
  private rng: Rng;
  private acc = 0;
  private systems: System[] = [opinionSystem, populationSystem];
  private listeners = new Set<EngineListener>();

  constructor(world: WorldState) {
    this.world = world;
    this.rng = new Rng(world.rngState);
  }

  get day(): number {
    return this.world.clock.day;
  }
  get dateIso(): string {
    return dayToIso(this.world.clock.startDate, this.world.clock.day);
  }

  addSystem(sys: System): void {
    this.systems.push(sys);
  }
  onEvent(fn: EngineListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  schedule(ev: NewEvent): ScheduledEvent {
    return schedule(this.world, ev);
  }
  setAutoPause(categories: EventCategory[]): void {
    this.world.settings.autoPauseCategories = [...categories];
  }
  setSpeed(daysPerSecond: number): void {
    this.speed = Math.max(0, Math.min(3650, daysPerSecond));
  }
  setPaused(p: boolean): void {
    this.paused = p;
    if (p) this.acc = 0;
  }

  /** 1日進める。自動停止対象の重要イベントが発生したら一時停止し、発生イベントを返す。 */
  stepDay(): ScheduledEvent[] {
    const w = this.world;
    w.clock.day += 1;
    const day = w.clock.day;
    for (const sys of this.systems) sys(w, this.rng, day);
    const due = popDue(w, day);
    w.rngState = this.rng.state;
    for (const ev of due) {
      for (const l of this.listeners) l(ev);
      if (ev.important && w.settings.autoPauseCategories.includes(ev.category)) {
        this.setPaused(true);
      }
    }
    return due;
  }

  /** 実経過ミリ秒を渡して進行させる(フレームレート非依存)。進めた日数を返す。 */
  tick(realDeltaMs: number): number {
    if (this.paused) return 0;
    this.world.playTimeMs += realDeltaMs;
    this.acc += (realDeltaMs / 1000) * this.speed;
    let steps = 0;
    while (this.acc >= 1 && !this.paused && steps < MAX_STEPS_PER_TICK) {
      this.acc -= 1;
      this.stepDay();
      steps++;
    }
    if (steps >= MAX_STEPS_PER_TICK) this.acc = 0; // 遅延の累積を捨てて暴走を防ぐ
    return steps;
  }

  /** ヘッドレス実行用: 指定日数を一括で進める(途中停止は無視しない)。 */
  runDays(n: number): void {
    for (let i = 0; i < n; i++) {
      const wasPaused = this.paused;
      this.stepDay();
      this.paused = wasPaused;
    }
  }

  /** ロード後にエンジン内部の乱数状態を再同期する */
  replaceWorld(world: WorldState): void {
    this.world = world;
    this.rng = new Rng(world.rngState);
    this.acc = 0;
  }
}

/** 全国平均支持率(人口加重)。保存せず都度計算する派生値。 */
export function nationalSupport(world: WorldState, partyId: string): number {
  let num = 0;
  let den = 0;
  for (const r of Object.values(world.regions)) {
    num += (world.support[r.id]?.[partyId] ?? 0) * r.population;
    den += r.population;
  }
  return den > 0 ? num / den : 0;
}
