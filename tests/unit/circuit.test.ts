import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/game/rng';
import { CIRCUIT_PRIZE_FACTOR, stagePrize } from '@/game/economy/prize';
import {
  LAP_MAX,
  LAP_MIN,
  MIN_RADIUS,
  fallbackCircuit,
  generateCircuit,
  lapClearOfItself,
  minRadius,
} from '@/game/stage/CircuitGenerator';
import { CIRCUIT_LAPS, lapTimes } from '@/game/stage/CircuitStage';
import { RoadPath } from '@/game/stage/RoadPath';
import { StageRun } from '@/game/stage/StageRun';
import { generateStage, stageBrief } from '@/game/stage/StageGenerator';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe('closed road paths', () => {
  const square = [0, 0, 100, 0, 100, 100, 0, 100];
  const path = RoadPath.fromClosedPolyline(square, 2);

  it('end on their first sample and wrap distances round the lap', () => {
    expect(path.closed).toBe(true);
    expect(path.length).toBeCloseTo(400, 6);
    expect(path.xs[path.count - 1]).toBe(path.xs[0]);
    expect(path.zs[path.count - 1]).toBe(path.zs[0]);
    const a = { x: 0, z: 0, heading: 0 };
    const b = { x: 0, z: 0, heading: 0 };
    path.sample(30, a);
    path.sample(30 + path.length, b);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.z).toBeCloseTo(a.z, 6);
    path.sample(-10, b);
    path.sample(path.length - 10, a);
    expect(b.x).toBeCloseTo(a.x, 6);
  });

  it('look across the seam for the headings at its ends', () => {
    expect(path.headings[0]).toBeCloseTo(path.headings[path.count - 1]!, 9);
  });
});

describe('circuit generator', () => {
  const layouts = Array.from({ length: 80 }, (_, i) => generateCircuit(mulberry32(1000 + i * 31)));

  it('is deterministic', () => {
    const a = generateCircuit(mulberry32(77));
    const b = generateCircuit(mulberry32(77));
    expect(Array.from(a.path.xs)).toEqual(Array.from(b.path.xs));
    expect(a.style).toBe(b.style);
  });

  it('makes valid laps: in length, no corner too tight, never close to itself', () => {
    for (const c of layouts) {
      expect(c.path.length).toBeGreaterThanOrEqual(LAP_MIN);
      expect(c.path.length).toBeLessThanOrEqual(LAP_MAX);
      expect(minRadius(c.path)).toBeGreaterThanOrEqual(MIN_RADIUS);
      expect(lapClearOfItself(c.path)).toBe(true);
      // The lap closes smoothly: no kink at the seam.
      const n = c.path.count - 1;
      expect(Math.abs(wrap(c.path.headings[1]! - c.path.headings[n - 1]!))).toBeLessThan(0.1);
      // It starts at the beginning of its main straight, with the line on it and room for the grid.
      expect(c.startDistance).toBeGreaterThan(60);
      expect(c.startDistance).toBeLessThan(c.mainStraight);
    }
  });

  it('draws all three styles, and the Sarthe has the longest straights', () => {
    const by = (s: string) => layouts.filter((c) => c.style === s);
    for (const s of ['ring', 'sarthe', 'park']) expect(by(s).length).toBeGreaterThan(10);
    const mean = (s: string) => by(s).reduce((a, c) => a + c.mainStraight, 0) / by(s).length;
    expect(mean('sarthe')).toBeGreaterThan(mean('ring'));
  });

  it('has a fallback that passes every check', () => {
    const f = fallbackCircuit();
    expect(f.path.length).toBeGreaterThanOrEqual(LAP_MIN);
    expect(minRadius(f.path)).toBeGreaterThanOrEqual(MIN_RADIUS);
    expect(lapClearOfItself(f.path)).toBe(true);
  });
});

describe('circuit stages', () => {
  const stage = generateStage(6, 9);
  const circuit = stage.circuit!;

  it('race three laps of a closed lap, with the brief agreeing', () => {
    expect(circuit.laps).toBe(CIRCUIT_LAPS);
    expect(stage.path.closed).toBe(true);
    expect(circuit.lapLength).toBeCloseTo(stage.path.length, 6);
    expect(stage.length).toBe(Math.round(CIRCUIT_LAPS * stage.path.length));
    const brief = stageBrief(6, 9);
    expect(brief.length).toBe(stage.length);
    expect(brief.parTime).toBe(stage.parTime);
    expect(brief.name).toBe(stage.name);
    expect(generateStage(6, 8).circuit).toBeUndefined();
  });

  it('unroll their gates over every lap: sectors, lap lines, then the finish', () => {
    const kinds = stage.gates.map((g) => g.kind);
    expect(kinds).toEqual([
      ...['checkpoint', 'checkpoint', 'checkpoint', 'lap'],
      ...['checkpoint', 'checkpoint', 'checkpoint', 'lap'],
      ...['checkpoint', 'checkpoint', 'checkpoint', 'finish'],
    ]);
    for (let i = 1; i < stage.gates.length; i++)
      expect(stage.gates[i]!.distance).toBeGreaterThan(stage.gates[i - 1]!.distance);
    const finish = stage.gates.at(-1)!;
    expect(finish.distance).toBeCloseTo(stage.startDistance + CIRCUIT_LAPS * circuit.lapLength, 6);
    // Every lap line and the finish stand where the start line is.
    for (const g of stage.gates.filter((g) => g.kind !== 'checkpoint')) {
      expect(Math.hypot(g.x - stage.gates[3]!.x, g.z - stage.gates[3]!.z)).toBeLessThan(1e-6);
    }
  });

  it('start the car on pole, behind the line', () => {
    const line = { x: 0, z: 0, heading: 0 };
    stage.path.sample(stage.startDistance, line);
    const dx = stage.spawn.x - line.x;
    const dz = stage.spawn.z - line.z;
    // Behind the line (negative along the heading) and off the centre line.
    expect(dx * Math.sin(line.heading) + dz * Math.cos(line.heading)).toBeLessThan(-5);
    expect(Math.abs(dx * Math.cos(line.heading) - dz * Math.sin(line.heading))).toBeGreaterThan(1);
  });

  it('only finish after the last lap, counting laps and unwrapping progress across the seam', () => {
    const run = new StageRun(stage);
    run.tick(3.1);
    expect(run.phase).toBe('running');
    const s = { x: 0, z: 0, heading: 0 };
    let d = stage.startDistance - 10;
    stage.path.sample(d, s);
    let px = s.x;
    let pz = s.z;
    let last = 0;
    const end = stage.startDistance + CIRCUIT_LAPS * circuit.lapLength + 5;
    const lapsSeen: number[] = [];
    while (d < end) {
      d += 1.5;
      stage.path.sample(d, s);
      run.tick(0.05);
      run.onMove(px, pz, s.x, s.z);
      px = s.x;
      pz = s.z;
      const p = run.progressAt(s.x, s.z);
      // Progress never runs backwards, even where the lap wraps to its start.
      expect(p).toBeGreaterThanOrEqual(last - 1e-9);
      last = p;
      if (lapsSeen.at(-1) !== run.lap) lapsSeen.push(run.lap);
      if (d < end - 10) expect(run.phase).toBe('running');
    }
    expect(run.phase).toBe('finished');
    expect(lapsSeen).toEqual([1, 2, 3]);
    expect(last).toBeCloseTo(1, 6);
    expect(run.laps).toHaveLength(CIRCUIT_LAPS);
    expect(run.bestLap).toBe(Math.min(...run.laps));
    expect(run.laps.reduce((a, b) => a + b, 0)).toBeCloseTo(run.totalTime, 6);
    // A replay reads the same laps back from the gate pass times.
    expect(run.lapAt(0)).toBe(1);
    expect(run.lapAt(run.time)).toBe(3);
  });

  it('time laps after a part-way spawn from the gates actually driven through', () => {
    const run = new StageRun(stage);
    // Spawn inside lap 2's last sector: everything before it counts as passed, with no splits.
    run.skipGatesBefore(stage.startDistance + circuit.lapLength * 1.9);
    expect(run.lap).toBe(2);
    run.tick(3.1);
    const s = { x: 0, z: 0, heading: 0 };
    let d = stage.startDistance + circuit.lapLength * 1.9;
    stage.path.sample(d, s);
    let [px, pz] = [s.x, s.z];
    while (run.phase !== 'finished' && d < stage.startDistance + circuit.lapLength * 3.2) {
      d += 1.5;
      stage.path.sample(d, s);
      run.tick(0.05);
      run.onMove(px, pz, s.x, s.z);
      [px, pz] = [s.x, s.z];
    }
    expect(run.phase).toBe('finished');
    // The partial lap 2 and the whole lap 3; nothing paired with a gate the car never crossed.
    expect(run.laps).toHaveLength(2);
    expect(run.laps[1]!).toBeGreaterThan(run.laps[0]!);
    expect(run.gatesPassedAt(0)).toBe(stage.gates.length - 5);
  });

  it('time laps from the lap and finish gates only', () => {
    expect(lapTimes(stage.gates, [10, 20, 30, 40, 50, 60, 70, 82])).toEqual([40, 42]);
  });

  it('pay a share of the race distance', () => {
    const race = { lengthM: 6000, surface: 'tarmac', parTime: 300, time: 300, loop: 1 } as const;
    expect(stagePrize({ ...race, circuit: true })).toBe(
      Math.round(stagePrize(race) * CIRCUIT_PRIZE_FACTOR),
    );
  });
});
