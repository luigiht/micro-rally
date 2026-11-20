/**
 * A circuit's figure of eight, as a polygon for `CircuitGenerator` to round
 * off: two lobes either side of a crossing, joined by two long straights
 * that cross at its middle (an X). The lap runs out along one straight,
 * round the right-hand lobe clockwise, back along the other straight
 * through the crossing and round the left-hand lobe anticlockwise. Each
 * lobe is a wobbly, dented ellipse of its own, stretched outward by the
 * style. Pure TS.
 */

export interface FigureEightShape {
  /** Corners in the whole lap (both lobes, the straights' ends included). */
  corners: readonly [number, number];
  /** How far each lobe stretches outward, away from the crossing. */
  stretch: number;
  jitter: number;
  /** Chance per lobe vertex of a dent pulled toward its centre. */
  dents: number;
}

export interface FigureEightPolygon {
  xs: number[];
  zs: number[];
  /** Edges (from vertex i to i+1) that cross: they stay straight, without chicanes or esses. */
  crossEdges: number[];
}

/** One lobe's vertices, from where the straight in meets it to where the straight out leaves it. */
function lobe(
  rand: () => number,
  shape: FigureEightShape,
  scale: number,
  count: number,
  mouth: number,
  half: number,
  side: 1 | -1,
): [number, number][] {
  const radius = scale * (0.62 + rand() * 0.18);
  const stretch = 0.75 + 0.35 * shape.stretch;
  // The lobe's centre sits out beyond its mouth, so the straights meet its near side.
  const cx = mouth * Math.cos(half) + radius * stretch * 0.62;
  const entry: [number, number] = [mouth * Math.cos(half), mouth * Math.sin(half)];
  const exit: [number, number] = [mouth * Math.cos(half), -mouth * Math.sin(half)];
  // Ellipse parameter angles of the mouth's two corners, and the clockwise sweep between them.
  const angle = (p: [number, number]) => Math.atan2(p[1], (p[0] - cx) / stretch);
  const a0 = angle(entry);
  const a1 = angle(exit);
  const sweep = (((a0 - a1) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const pts: [number, number][] = [entry];
  const inner = count - 2;
  // The right-hand lobe leaves a share of its sweep without corners (as a share of the rest): one
  // long straight for the start, longer the more the style stretches.
  const gap = side === 1 ? 0.1 + 0.33 * shape.stretch : 0;
  const gapFrom = 0.15 + rand() * 0.35;
  const spread = (u: number) => (u < gapFrom ? u : u + gap) / (1 + gap);
  for (let j = 0; j < inner; j++) {
    const u = (j + 1 + (rand() - 0.5) * 0.5) / (inner + 1);
    const a = a0 - sweep * spread(u);
    const dent = rand() < shape.dents ? 0.62 : 1;
    const r = radius * (1 + (rand() - 0.5) * 2 * shape.jitter) * dent;
    pts.push([cx + Math.cos(a) * r * stretch, Math.sin(a) * r]);
  }
  pts.push(exit);
  // The left-hand lobe is the right-hand one's mirror, which also turns it anticlockwise.
  return side === 1 ? pts : pts.map(([x, z]) => [-x, z]);
}

export function figureEightPolygon(
  rand: () => number,
  shape: FigureEightShape,
  scale: number,
): FigureEightPolygon {
  const k = shape.corners[0] + Math.floor(rand() * (shape.corners[1] - shape.corners[0] + 1));
  const right = Math.max(4, Math.ceil(k / 2));
  const left = Math.max(4, k - right + 1);
  // Half the angle between the two straights (they cross at 2·half), and how far out each lobe's mouth is.
  const half = 0.5 + rand() * 0.25;
  const mouth = scale * (0.85 + rand() * 0.25);
  const spin = rand() * Math.PI * 2;
  const pts = [
    ...lobe(rand, shape, scale, right, mouth, half, 1),
    ...lobe(rand, shape, scale, left, mouth, half, -1),
  ];
  const xs: number[] = [];
  const zs: number[] = [];
  for (const [u, v] of pts) {
    xs.push(u * Math.cos(spin) - v * Math.sin(spin));
    zs.push(u * Math.sin(spin) + v * Math.cos(spin));
  }
  // The right lobe's exit runs to the left lobe's entry, and the left lobe's exit back to the start.
  return { xs, zs, crossEdges: [right - 1, pts.length - 1] };
}
