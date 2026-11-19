import type { SurfaceSpan } from '@/game/stage/SurfaceSpans';
import { bridgeSpan } from '@/game/stage/Rivers';
import type { TerrainField } from '@/game/stage/TerrainField';

/**
 * How the road ribbon follows a road that changes surface along its length
 * (`TerrainField.surfaceRuns`, the Lakeland's tarmac and mud): where its
 * pieces break, so each piece is one surface and is drawn as that surface's
 * road, and how far mud is tracked out onto the tarmac either side of a mud
 * stretch. Also every bridge's span, rivers' and lakes' alike.
 */

/** Mud is carried this far onto the tarmac past either end of a mud stretch, thinning out, each lane band's tongue reaching up to `RAG` metres more or less. */
const SPILL = 30;
const RAG = 9;
/**
 * The tarmac this close to a mud stretch is the spill zone, a piece of its
 * own drawn with the mud's rut layout (no worn lane bands), so the ruts run
 * on unbroken from the mud into the tracked-on mud and fade with it.
 */
export const SPILL_ZONE = SPILL + RAG + 1;
/** Past the spill zone the worn tarmac's bands, dips and shades ease in over this far. */
const WORN_EASE = 25;
/** At the stretch's very end the tarmac is all mud, so the two meet without a seam. */
const SPILL_MAX = 1;

/**
 * The ribbon's pieces as sample-index pairs: every `perPiece` samples, and
 * also at each change of surface, so no piece straddles two.
 */
export function pieceBreaks(
  count: number,
  spacing: number,
  perPiece: number,
  runs: readonly SurfaceSpan[] | null,
): [number, number][] {
  const cuts = new Set<number>();
  for (let s = 0; s < count - 1; s += perPiece) cuts.add(s);
  if (runs)
    for (let j = 0; j < runs.length; j++) {
      const r = runs[j]!;
      const marks = [r.from];
      // Either side of a mud stretch the tarmac's spill zone is a piece of its own.
      if (r.surface === 'mud') {
        if (j > 0) marks.push(r.from - SPILL_ZONE);
        if (Number.isFinite(r.to)) marks.push(r.to + SPILL_ZONE);
      }
      for (const m of marks) {
        const i = Math.round(m / spacing);
        if (i > 0 && i < count - 1) cuts.add(i);
      }
    }
  const sorted = [...cuts].sort((a, b) => a - b);
  return sorted.map((s0, j) => [s0, sorted[j + 1] ?? count - 1]);
}

/** Road distances where a mud stretch meets another surface. */
function mudEdges(runs: readonly SurfaceSpan[]): number[] {
  const out: number[] = [];
  for (let j = 0; j < runs.length; j++) {
    const r = runs[j]!;
    if (r.surface !== 'mud') continue;
    if (j > 0) out.push(r.from);
    if (Number.isFinite(r.to)) out.push(r.to);
  }
  return out;
}

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The share of a tarmac station's colour turned to mud (sample `k`): the
 * mud tracked out of a mud stretch by the cars before, thick at its end and
 * thinning in patches over `SPILL` metres. Null where nothing changes surface.
 */
export function mudSpill(
  runs: readonly SurfaceSpan[] | null,
  spacing: number,
): ((k: number, band: number) => number) | null {
  if (!runs) return null;
  const edges = mudEdges(runs);
  if (edges.length === 0) return null;
  return (k, band) => {
    const d = k * spacing;
    let near = Infinity;
    let edge = 0;
    for (const e of edges)
      if (Math.abs(d - e) < near) {
        near = Math.abs(d - e);
        edge = e;
      }
    // Each lane band's tongue of mud reaches its own way onto the tarmac.
    const reach = SPILL + RAG * (2 * hash01(Math.round(edge) * 7 + band * 131) - 1);
    if (near >= reach) return 0;
    const t = 1 - near / reach;
    // Clods and smears: every couple of metres a little more or less of it, solid at the join.
    const patch = 0.5 + 0.5 * hash01(Math.floor(d / 2) * 13 + band * 71);
    return SPILL_MAX * t * t * (patch + (1 - patch) * t * t);
  };
}

/** Over this far either side of a change of surface the ruts and worn dips flatten out, so both pieces meet flush. */
const SEAM = 14;

/** The painted edge lines stop this far short of a mud stretch, fading into the mud over `LINE_FADE` before it. */
export const LINE_STOP = 0.5;
export const LINE_FADE = 26;

/** 0..1 how far an edge line has faded into the mud at `distance` metres from a change of surface. */
export function lineFade(distance: number): number {
  const t = 1 - Math.min(1, Math.max(0, (distance - LINE_STOP) / (LINE_FADE - LINE_STOP)));
  return t * t * (3 - 2 * t);
}

/**
 * Metres from road distance `d` to the nearest change of surface (Infinity
 * where nothing changes), and how fully the surfaces' relief (ruts, worn
 * dips and their tones) shows there: 0 at the change, 1 from `SEAM` out.
 */
export function seamFade(runs: readonly SurfaceSpan[] | null): {
  distance: (d: number) => number;
  relief: (d: number) => number;
  worn: (d: number) => number;
} {
  const edges = runs ? runs.slice(1).map((r) => r.from) : [];
  const distance = (d: number) => {
    let near = Infinity;
    for (const e of edges) near = Math.min(near, Math.abs(d - e));
    return near;
  };
  return {
    distance,
    relief: (d) => {
      const t = Math.min(1, distance(d) / SEAM);
      return t * t * (3 - 2 * t);
    },
    // The worn tarmac's relief: none in the spill zone, easing in past it.
    worn: (d) => {
      const t = Math.min(1, Math.max(0, (distance(d) - SPILL_ZONE) / WORN_EASE));
      return t * t * (3 - 2 * t);
    },
  };
}

/** Every bridge's span along the road: the rivers' stone arches and the lakes' long bridges. */
export function bridgeRuns(field: TerrainField): { from: number; to: number }[] {
  return [
    ...field.rivers.map((r) => bridgeSpan(r)),
    ...field.lakes.flatMap((l) => (l.bridge ? [l.bridge] : [])),
  ];
}
