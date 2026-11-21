import type { TerrainQuery } from '@/game/vehicle/Terrain';
import type { WheelContact } from '@/game/vehicle/wheelContacts';
import type { WaterSpray } from './WaterSpray';

/**
 * Decides when and how a car's tyres throw spray (`WaterSpray`): each frame,
 * every wheel standing in water (`surfaceAt` is `water`) at speed throws a
 * stream in proportion to its speed, and the frame a wheel first plunges in it
 * throws a burst, the big fan of the reference photos. The spray leaves each
 * tyre outward, up, and on ahead with the car, white water with brown in it.
 * Driven from the wheels' places, so it works the same for the live car, a
 * replay, or an opponent's ghost.
 */

export interface SprayCar {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
}

/** Below this speed (m/s) a tyre only wades. */
const MIN_SPEED = 3;
/** Particles per second per wheel, per m/s of speed; a plunge's burst per wheel, at 20 m/s. */
const RATE = 3.2;
const BURST = 22;
/** Of the car's velocity, the share the spray keeps going forward with. */
const CARRY = 0.45;

export class SprayEmitter {
  private readonly inWater = [false, false, false, false];
  private debt = [0, 0, 0, 0];
  private seed = 0x9e3779b9;

  constructor(private readonly spray: WaterSpray) {}

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Forget which wheels were in the water (a restart or the replay starting). */
  reset(): void {
    this.inWater.fill(false);
    this.debt.fill(0);
  }

  /**
   * Throw this frame's spray for a car whose four wheels touch the ground at
   * `contacts` (front-left, front-right, rear-left, rear-right). Under reduced
   * motion the spray stays low, short and sparse.
   */
  update(
    contacts: readonly WheelContact[],
    car: SprayCar,
    terrain: TerrainQuery,
    time: number,
    dt: number,
    reduced: boolean,
  ): void {
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const scale = reduced ? 0.35 : 1;
    for (let i = 0; i < 4; i++) {
      const c = contacts[i]!;
      const wet = terrain.surfaceAt(c.x, c.z) === 'water';
      const plunged = wet && !this.inWater[i];
      this.inWater[i] = wet;
      if (!wet || car.speed < MIN_SPEED) {
        this.debt[i] = 0;
        continue;
      }
      // Left wheels (even) throw to the car's left, right wheels to its right.
      const out = i % 2 === 0 ? 1 : -1;
      const lx = fz * out;
      const lz = -fx * out;
      const pace = Math.min(car.speed, 35) / 20;
      this.debt[i]! += RATE * car.speed * dt * scale;
      let n = Math.floor(this.debt[i]!);
      this.debt[i]! -= n;
      if (plunged) n += Math.round(BURST * pace * scale);
      // The front tyres meet the water first and throw the most.
      const front = i < 2 ? 1 : 0.7;
      while (n-- > 0) {
        const side = (2 + this.random() * 6) * pace * front * scale;
        const up = (2.2 + this.random() * 5) * pace * front * (reduced ? 0.4 : 1);
        const ahead = CARRY * (0.5 + this.random() * 0.7);
        this.spray.emit(
          time,
          c.x + lx * 0.15,
          c.y + 0.12,
          c.z + lz * 0.15,
          lx * side + car.vx * ahead + (this.random() - 0.5) * 1.5,
          up,
          lz * side + car.vz * ahead + (this.random() - 0.5) * 1.5,
          (0.45 + this.random() * 0.7) * (reduced ? 0.7 : 1),
          this.random() * 0.85,
        );
      }
    }
  }
}
