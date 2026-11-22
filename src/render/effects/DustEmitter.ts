import type { Surface } from '@/game/vehicle/surfaces';
import type { TerrainQuery } from '@/game/vehicle/Terrain';
import type { WheelContact } from '@/game/vehicle/wheelContacts';
import type { ParticleRing } from './ParticleRing';
import type { SprayCar } from './SprayEmitter';

/**
 * Dust trails (the Savanna's): each frame, the rear tyres of a car going fast
 * on dry earth throw soft puffs of dust behind it and a little up, in
 * proportion to its speed, into a `ParticleRing` that lets them hang, swell
 * and fade over a couple of seconds, so a fast car draws a long billowing
 * trail. Fech-fech throws far more, paler and bigger, enough to veil the road
 * for a moment. Driven from the wheels' places, like the spray, so replays and
 * opponents dust too.
 */

/** Below this speed (m/s) no dust; it thickens up to `FULL`. */
const MIN_SPEED = 4;
const FULL = 26;
/** Puffs per second per rear wheel at full pace, and how much more fech-fech throws. */
const RATE = 24;
/** Fech-fech throws this many times as many puffs, bigger and higher: the murram's own trail is a light one. */
const FECH_RATE = 3.4;

export class DustEmitter {
  private readonly debt = [0, 0];
  private seed = 0x51ed2701;

  /**
   * @param dusty which surfaces throw dust (the stage's road and its fech-fech)
   */
  constructor(
    private readonly dust: ParticleRing,
    private readonly dusty: ReadonlySet<Surface>,
  ) {}

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  reset(): void {
    this.debt.fill(0);
  }

  /** Throw this frame's dust from the rear wheels (`contacts[2]`, `contacts[3]`). */
  update(
    contacts: readonly WheelContact[],
    car: SprayCar,
    grounded: boolean,
    terrain: TerrainQuery,
    time: number,
    dt: number,
    reduced: boolean,
  ): void {
    if (!grounded || car.speed < MIN_SPEED) {
      this.debt.fill(0);
      return;
    }
    const pace = Math.min(1, (car.speed - MIN_SPEED) / (FULL - MIN_SPEED));
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const scale = reduced ? 0.3 : 1;
    for (let w = 0; w < 2; w++) {
      const c = contacts[2 + w]!;
      const surface = terrain.surfaceAt(c.x, c.z);
      if (!this.dusty.has(surface)) {
        this.debt[w] = 0;
        continue;
      }
      const fech = surface === 'fechfech';
      this.debt[w]! += RATE * (0.3 + 0.7 * pace) * (fech ? FECH_RATE : 1) * dt * scale;
      let n = Math.floor(this.debt[w]!);
      this.debt[w]! -= n;
      const out = w === 0 ? 1 : -1;
      while (n-- > 0) {
        // Out behind the wheel, kicked up and sideways a little, carried on a share of the car's way.
        const back = 1.5 + this.random() * 3 * pace;
        const side = (this.random() - 0.5) * (fech ? 3 : 2) + out * 0.6;
        // The murram's dust stays low; fech-fech's billows up high.
        const lift = fech ? 1 : 0.45;
        const up = ((reduced ? 0.3 : 0.8) + this.random() * (reduced ? 0.4 : 1.6)) * lift;
        this.dust.emit(
          time,
          c.x - fx * 0.3,
          c.y + 0.25,
          c.z - fz * 0.3,
          car.vx * 0.25 - fx * back + fz * side,
          up,
          car.vz * 0.25 - fz * back - fx * side,
          (fech ? 1.25 : 0.62) * (0.7 + this.random() * 0.6) * (reduced ? 0.7 : 1),
          fech ? this.random() * 0.25 : 0.55 + this.random() * 0.45,
        );
      }
    }
  }
}
