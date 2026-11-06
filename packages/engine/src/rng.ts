/** シード付き乱数(mulberry32)。状態は1つの整数で、セーブに含められる。 */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  get state(): number {
    return this.s;
  }
  setState(s: number): void {
    this.s = s >>> 0;
  }
  /** [0,1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  /** 平均0・分散1の近似正規分布 */
  gauss(): number {
    let u = 0;
    for (let i = 0; i < 6; i++) u += this.next();
    return (u - 3) / Math.sqrt(0.5);
  }
}
