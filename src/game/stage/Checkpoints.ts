export type GateKind = 'checkpoint' | 'finish';

export interface Gate {
  kind: GateKind;
  /** Distance along the road, metres. */
  distance: number;
  x: number;
  z: number;
  heading: number;
  halfWidth: number;
}

/** True if the move from (px,pz) to (x,z) crosses the gate line forwards, inside its width. */
export function crossesGate(g: Gate, px: number, pz: number, x: number, z: number): boolean {
  const fx = Math.sin(g.heading);
  const fz = Math.cos(g.heading);
  const s0 = (px - g.x) * fx + (pz - g.z) * fz;
  const s1 = (x - g.x) * fx + (z - g.z) * fz;
  if (!(s0 < 0 && s1 >= 0)) return false;
  const t = s0 / (s0 - s1);
  const ix = px + (x - px) * t - g.x;
  const iz = pz + (z - pz) * t - g.z;
  // Lateral axis (left) is (cos, -sin).
  return Math.abs(ix * fz - iz * fx) <= g.halfWidth;
}

/** Enforces gate order: only the next gate can be passed. */
export class CheckpointTracker {
  next = 0;

  constructor(readonly gates: readonly Gate[]) {}

  get finished(): boolean {
    return this.next >= this.gates.length;
  }

  /** Returns the index of the gate passed by this move, or -1. */
  update(px: number, pz: number, x: number, z: number): number {
    const g = this.gates[this.next];
    if (!g || !crossesGate(g, px, pz, x, z)) return -1;
    return this.next++;
  }

  reset(): void {
    this.next = 0;
  }
}
