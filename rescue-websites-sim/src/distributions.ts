// Per-vertical dice for the rescue-websites pipeline simulator.
//
// Numbers are rough estimates from cold-outreach industry benchmarks;
// the simulator's purpose is to surface state-machine bugs, not to
// predict campaign performance, so order-of-magnitude is enough.
// Tune freely if Gus has better data.

export type Vertical =
  | 'dentistry'
  | 'construction'
  | 'roofing'
  | 'hvac'
  | 'legal'
  | 'medspa';

export interface VerticalProfile {
  // Median PageSpeed-style score 0-100. Lower = worse site = better lead.
  scoreMedian: number;
  scoreStdDev: number;

  // Probability the audit step finds a contact email.
  emailFoundRate: number;

  // Per-send probabilities (each independent roll on a sent email).
  replyRate: number;       // recipient replies "yes interested"
  hardStopRate: number;    // recipient replies "stop" or hits unsubscribe
  snoozeRate: number;      // recipient replies "not now, follow up later"
  bounceRate: number;      // 5xx hard bounce
  complaintRate: number;   // recipient marks as spam (FBL feedback)

  // Does the simulator have generated-mockup templates for this vertical?
  // Mirrors upstream README: only dentistry + construction are built.
  hasTemplates: boolean;
}

export const VERTICALS: Record<Vertical, VerticalProfile> = {
  dentistry:    { scoreMedian: 50, scoreStdDev: 20, emailFoundRate: 0.70, replyRate: 0.020, hardStopRate: 0.005, snoozeRate: 0.05, bounceRate: 0.03, complaintRate: 0.001, hasTemplates: true  },
  construction: { scoreMedian: 45, scoreStdDev: 25, emailFoundRate: 0.60, replyRate: 0.015, hardStopRate: 0.005, snoozeRate: 0.04, bounceRate: 0.04, complaintRate: 0.002, hasTemplates: true  },
  roofing:      { scoreMedian: 50, scoreStdDev: 20, emailFoundRate: 0.65, replyRate: 0.020, hardStopRate: 0.005, snoozeRate: 0.05, bounceRate: 0.03, complaintRate: 0.001, hasTemplates: false },
  hvac:         { scoreMedian: 50, scoreStdDev: 20, emailFoundRate: 0.60, replyRate: 0.020, hardStopRate: 0.005, snoozeRate: 0.05, bounceRate: 0.03, complaintRate: 0.001, hasTemplates: false },
  legal:        { scoreMedian: 65, scoreStdDev: 15, emailFoundRate: 0.80, replyRate: 0.010, hardStopRate: 0.003, snoozeRate: 0.03, bounceRate: 0.02, complaintRate: 0.001, hasTemplates: false },
  medspa:       { scoreMedian: 70, scoreStdDev: 15, emailFoundRate: 0.75, replyRate: 0.010, hardStopRate: 0.003, snoozeRate: 0.03, bounceRate: 0.02, complaintRate: 0.001, hasTemplates: false },
};

// Mulberry32 — small, fast, seedable PRNG. Good enough for sim dice.
export class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // Box-Muller standard normal
  normal(mean = 0, stdDev = 1): number {
    const u1 = this.next() || Number.MIN_VALUE;
    const u2 = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  // Inclusive integer in [min, max]
  intBetween(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
  bernoulli(p: number): boolean {
    return this.next() < p;
  }
}

// Convenience: clamp a normal-distributed score to [0, 100] integer.
export function rollScore(rng: Rng, v: VerticalProfile): number {
  const raw = rng.normal(v.scoreMedian, v.scoreStdDev);
  return Math.max(0, Math.min(100, Math.round(raw)));
}
