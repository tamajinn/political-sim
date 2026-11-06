import { ideologyMatch } from "../data/japan";
import type { Rng } from "../rng";
import type { WorldState } from "../types";

/**
 * Phase 1 の基礎世論ダイナミクス。
 * 各地域の政党支持率を「思想相性から決まる基準値」へ緩やかに引き戻しつつ、
 * 小さなランダムウォークを加える(1日単位)。合計は90%以内に保つ。
 *
 * 注意: これは国民集団モデル(Phase 2)に置き換わる暫定ロジック。
 * 経済・イベントとはまだ連動していない。
 */
export function opinionSystem(world: WorldState, rng: Rng): void {
  const volatility = { casual: 0.04, standard: 0.06, real: 0.09, hard: 0.12 }[world.settings.difficulty];
  const reversion = 0.004;

  for (const region of Object.values(world.regions)) {
    const s = world.support[region.id];
    if (!s) continue;
    let total = 0;
    for (const party of Object.values(world.parties)) {
      const base = Math.max(2, ideologyMatch(party.ideology, region.ideology) * 38 + 5);
      const cur = s[party.id] ?? base;
      const next = cur + (base - cur) * reversion + rng.gauss() * volatility;
      s[party.id] = Math.max(0, next);
      total += s[party.id]!;
    }
    if (total > 90) {
      const k = 90 / total;
      for (const id of Object.keys(s)) s[id] = s[id]! * k;
    }
  }
}

/** 人口の自然変動(年0.1%減を日割り+ゆらぎ)。 */
export function populationSystem(world: WorldState, rng: Rng): void {
  for (const r of Object.values(world.regions)) {
    r.population = Math.max(1, r.population * (1 - 0.001 / 365 + rng.gauss() * 0.00002));
  }
}
