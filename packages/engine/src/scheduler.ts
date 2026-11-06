import type { ScheduledEvent, WorldState } from "./types";

export type NewEvent = Omit<ScheduledEvent, "id">;

/** 日付ベースのイベントキュー。キューは常に (day, id) 昇順に保つ。 */
export function schedule(world: WorldState, ev: NewEvent): ScheduledEvent {
  const full: ScheduledEvent = { ...ev, id: world.scheduler.nextId++ };
  const q = world.scheduler.queue;
  let i = q.length;
  while (i > 0) {
    const prev = q[i - 1]!;
    if (prev.day < full.day || (prev.day === full.day && prev.id < full.id)) break;
    i--;
  }
  q.splice(i, 0, full);
  return full;
}

/** 指定日以前に期日の来たイベントを取り出して履歴へ移す */
export function popDue(world: WorldState, day: number): ScheduledEvent[] {
  const q = world.scheduler.queue;
  const due: ScheduledEvent[] = [];
  while (q.length > 0 && q[0]!.day <= day) {
    const ev = q.shift()!;
    due.push(ev);
    world.eventHistory.push({
      id: ev.id, day: ev.day, kind: ev.kind, category: ev.category, title: ev.title,
    });
  }
  return due;
}
