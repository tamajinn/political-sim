const MS_PER_DAY = 86_400_000;

export function dayToIso(startDate: string, day: number): string {
  const [y, m, d] = startDate.split("-").map(Number) as [number, number, number];
  const t = Date.UTC(y, m - 1, d) + day * MS_PER_DAY;
  return new Date(t).toISOString().slice(0, 10);
}

export function isoToDay(startDate: string, iso: string): number {
  const [y, m, d] = startDate.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = iso.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y, m - 1, d)) / MS_PER_DAY);
}
