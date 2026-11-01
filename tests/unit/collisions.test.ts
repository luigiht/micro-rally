import { describe, expect, it } from 'vitest';
import {
  ObstacleGrid,
  resolveObstacleCollisions,
  type BoxObstacle,
} from '@/game/vehicle/Collisions';
import { createVehicleState } from '@/game/vehicle/VehicleSim';

const wallAcross = (z: number): BoxObstacle => ({ x: 0, z, hx: 4, hz: 0.3, yaw: 0 });

describe('box obstacles', () => {
  it('stops a car driving head-on into a wall and reports the impact speed', () => {
    const grid = new ObstacleGrid([], [wallAcross(5)]);
    const s = createVehicleState();
    // Front circle (1 m ahead) is 0.1 m from the wall's near face at 4.7.
    s.z = 3.6;
    s.vz = 10;
    const impact = resolveObstacleCollisions(s, grid);
    expect(impact).toBeCloseTo(10);
    expect(s.vz).toBeLessThan(0);
    expect(s.z + 1).toBeCloseTo(4.7 - 0.9, 5);
  });

  it('lets a car slide along a wall without slowing or bouncing', () => {
    const wall: BoxObstacle = { x: 2, z: 0, hx: 0.3, hz: 20, yaw: 0 };
    const grid = new ObstacleGrid([], [wall]);
    const s = createVehicleState();
    s.x = 1.2;
    s.vz = 12;
    const impact = resolveObstacleCollisions(s, grid);
    expect(impact).toBe(0);
    expect(s.x).toBeCloseTo(2 - 0.3 - 0.9, 5);
    expect(s.vz).toBe(12);
    expect(s.vx).toBe(0);
  });

  it('handles a rotated box using the car yaw convention', () => {
    // yaw π/2 turns the box's long axis onto world +x; it stands across the car's path at z 4.
    const bar: BoxObstacle = { x: 0, z: 4, hx: 0.3, hz: 5, yaw: Math.PI / 2 };
    const grid = new ObstacleGrid([], [bar]);
    const s = createVehicleState();
    s.z = 2.6;
    s.vz = 8;
    const impact = resolveObstacleCollisions(s, grid);
    expect(impact).toBeCloseTo(8);
    expect(s.vz).toBeLessThan(0);
    expect(s.z + 1).toBeCloseTo(4 - 0.3 - 0.9, 5);
  });

  it('files long boxes into every cell they reach', () => {
    // A 12 m barrier centred far from the origin; the car hits its end, two cells away from the centre.
    const barrier: BoxObstacle = { x: 40, z: 40, hx: 6, hz: 0.4, yaw: 0 };
    const grid = new ObstacleGrid([], [barrier]);
    const s = createVehicleState();
    s.x = 45.5;
    s.z = 38.6;
    s.vz = 6;
    expect(resolveObstacleCollisions(s, grid)).toBeCloseTo(6);
    expect(s.z + 1).toBeCloseTo(40 - 0.4 - 0.9, 5);
  });

  it('pushes a car whose centre is inside a box out through the nearest face', () => {
    const grid = new ObstacleGrid([], [wallAcross(5)]);
    const s = createVehicleState();
    s.z = 3.95;
    s.vz = 3;
    resolveObstacleCollisions(s, grid);
    // Front circle centre was at 4.95, inside the 4.7..5.3 slab: it leaves through the near face.
    expect(s.z + 1).toBeCloseTo(4.7 - 0.9, 5);
    expect(s.vz).toBeLessThan(0);
  });

  it('keeps circles working alongside boxes', () => {
    const grid = new ObstacleGrid([{ x: 0, z: 3, r: 0.45 }], [wallAcross(30)]);
    const s = createVehicleState();
    s.z = 1.5;
    s.vz = 15;
    expect(resolveObstacleCollisions(s, grid)).toBeCloseTo(15);
  });
});
