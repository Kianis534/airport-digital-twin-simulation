// Seeded random number generator (mulberry32) with the distributions the model needs.

export class Random {
  private state: number;
  private spareGauss: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  random(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(low: number, high: number): number {
    return low + (high - low) * this.random();
  }

  /** Same argument order as Python's random.triangular(low, high, mode). */
  triangular(low: number, high: number, mode: number): number {
    const u = this.random();
    const c = (mode - low) / (high - low);
    if (u < c) return low + Math.sqrt(u * (high - low) * (mode - low));
    return high - Math.sqrt((1 - u) * (high - low) * (high - mode));
  }

  gauss(mean: number, sd: number): number {
    if (this.spareGauss !== null) {
      const value = this.spareGauss;
      this.spareGauss = null;
      return mean + sd * value;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = this.random();
    while (v === 0) v = this.random();
    const mag = Math.sqrt(-2 * Math.log(u));
    this.spareGauss = mag * Math.sin(2 * Math.PI * v);
    return mean + sd * mag * Math.cos(2 * Math.PI * v);
  }

  choice<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }

  weightedChoice<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.random() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}
