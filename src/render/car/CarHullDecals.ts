/**
 * Painted patches on a lofted hull (`CarHull.ts`). Deck decals split the top
 * faces along x, side decals split the pillar band across its width and cap
 * decals split the nose and tail panels along x, so every patch is made of
 * the hull's own faces and follows the surface exactly instead of sitting on
 * it. A glowing patch is drawn unlit by the mesh, so it reads as a lit lens.
 */

/** A signed x range across the car, optionally mirrored about the centre line. */
interface XSpan {
  /** x0 < x1. */
  x0: number;
  x1: number;
  color: string;
  /** Also paint the range mirrored about the centre line. */
  mirror?: boolean;
  /** Drawn unlit, so it reads as a lit lens whatever the light does. */
  glow?: boolean;
}

/** A painted patch on the top surface (bonnet, roof, deck); never drawn over glass. */
export interface DeckDecal extends XSpan {
  /** Length range along the car, z0 < z1. */
  z0: number;
  z1: number;
}

/** A painted patch on an end panel (nose or tail), between two heights. */
export interface CapDecal extends XSpan {
  end: 'nose' | 'tail';
  /** Height range on the panel, y0 < y1; a band is painted when its middle lies inside. */
  y0: number;
  y1: number;
}

/**
 * A painted patch on the pillar band, between the belt line and the roof
 * edge, where it is not glass. The band is a twisted surface, so the patch is
 * given across it as fractions of the way from the belt edge to the roof edge.
 */
export interface SideDecal {
  /** Length range along the car, z0 < z1. */
  z0: number;
  z1: number;
  /** Fractions across the band from the belt edge (0) to the roof edge (1), u0 < u1. */
  u0: number;
  u1: number;
  color: string;
  glow?: boolean;
  /** Only this side of the car (+1 left, −1 right); omitted = both. */
  side?: 1 | -1;
}

/** An interval along a band to paint, in the band's own coordinate (absolute x, or the across fraction). */
export interface Patch {
  a: number;
  b: number;
  color: string;
  glow: boolean;
}

/** Spans as absolute-x intervals on one side of the car (sgn = +1 left, -1 right). */
function spansOnSide(spans: readonly XSpan[], sgn: 1 | -1): Patch[] {
  const out: Patch[] = [];
  for (const d of spans) {
    for (const m of d.mirror ? [1, -1] : [1]) {
      const lo = Math.min(d.x0 * m, d.x1 * m) * sgn;
      const hi = Math.max(d.x0 * m, d.x1 * m) * sgn;
      const a = Math.max(0, Math.min(lo, hi));
      const b = Math.max(lo, hi);
      if (b > a + 1e-6) out.push({ a, b, color: d.color, glow: Boolean(d.glow) });
    }
  }
  return out;
}

/** Deck decals covering `z`, as x intervals on one side. */
export function deckPatches(deck: readonly DeckDecal[], z: number, sgn: 1 | -1): Patch[] {
  return spansOnSide(
    deck.filter((d) => z >= d.z0 && z <= d.z1),
    sgn,
  );
}

/** Cap decals on `end` covering height `y`, as x intervals on one side. */
export function capPatches(
  caps: readonly CapDecal[],
  end: 'nose' | 'tail',
  y: number,
  sgn: 1 | -1,
): Patch[] {
  return spansOnSide(
    caps.filter((d) => d.end === end && y >= d.y0 && y <= d.y1),
    sgn,
  );
}

/** Side decals covering `z` on one side, as intervals across the band. */
export function sidePatches(decals: readonly SideDecal[], z: number, sgn: 1 | -1): Patch[] {
  const out: Patch[] = [];
  for (const d of decals) {
    if (z < d.z0 || z > d.z1) continue;
    if (d.side !== undefined && d.side !== sgn) continue;
    const a = Math.max(0, Math.min(d.u0, d.u1));
    const b = Math.min(1, Math.max(d.u0, d.u1));
    if (b > a + 1e-6) out.push({ a, b, color: d.color, glow: Boolean(d.glow) });
  }
  return out;
}

/** Every patch edge strictly inside (0, limit), ascending: where a band must be split. */
export function patchCuts(patches: readonly Patch[], limit: number): number[] {
  return [...new Set(patches.flatMap((p) => [p.a, p.b]))]
    .filter((x) => x > 1e-6 && x < limit - 1e-6)
    .sort((u, v) => u - v);
}

/** The patch painting `at`, if any; later patches win where they overlap. */
export function patchAt(patches: readonly Patch[], at: number): Patch | null {
  let hit: Patch | null = null;
  for (const p of patches) if (at > p.a && at < p.b) hit = p;
  return hit;
}
