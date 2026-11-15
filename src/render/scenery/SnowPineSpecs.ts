/**
 * The Alpine's tiered snow pines (`SnowPineGeometry`), one spec a silhouette:
 * broad, tall, leaning, young, snow-laden, sparse, columnar, lopsided,
 * squat, the laden giant and the white spire, the chunky faceted firs
 * (after the snowy sets in `context/low-poly-snowy-trees`), a bent top, a
 * wide cone, a needle and a lightly dusted fir. Their reach runs from 1 m to
 * 2.1 m and their height from 3.4 m to 8 m, so the wood varies in width and
 * height as well as in shape.
 */

export interface PineSpec {
  /** Salt for the tree's own branch lengths. */
  salt: number;
  tiers: number;
  /** The lowest tier's foot, and the tree's point (before the leader). */
  foot: number;
  top: number;
  /** The lowest and the highest tier's reach, and the curve between them (1 straight, more for a fuller middle). */
  reach: number;
  topReach: number;
  fullness?: number;
  /** A tier's height over the spacing between tiers (1.75 by default): less stands the tiers apart, each one's snowy point showing under the next. */
  overlap?: number;
  /** How far out along the branches the snow lies (0..1 of the way from each point to its tips). */
  snow?: number;
  /** The top's sideways shift, growing up the tree; and each tier's shift either side (lopsided). */
  lean?: number;
  sway?: number;
  /** How far the branch tips droop, as a share of a tier's height. */
  droop?: number;
  /**
   * Chunky firs: this many tips a tier whatever its width (6–8 by its width
   * otherwise), each reaching up to `jag` further or shorter (0.12), notches
   * pulled in only to `notch` of the reach (0.64), and each tier set up to
   * `offset` metres off the trunk's line.
   */
  tips?: number;
  jag?: number;
  notch?: number;
  offset?: number;
  /** The trunk's foot radius. */
  trunk: number;
  /** Where between the region's two pine greens this tree's green lies (0..1), and its brightness. */
  green: number;
  shade: number;
}

export const PINE_SPECS: readonly PineSpec[] = [
  // Broad: wide, flat tiers.
  {
    salt: 1,
    tiers: 4,
    foot: 1.0,
    top: 5.3,
    reach: 1.85,
    topReach: 0.62,
    trunk: 0.27,
    green: 0.1,
    shade: 1,
  },
  // Tall and narrow.
  {
    salt: 2,
    tiers: 6,
    foot: 0.9,
    top: 6.4,
    reach: 1.35,
    topReach: 0.42,
    trunk: 0.22,
    green: 0.55,
    shade: 0.95,
  },
  // Leaning top.
  {
    salt: 3,
    tiers: 4,
    foot: 1.0,
    top: 5.1,
    reach: 1.55,
    topReach: 0.55,
    lean: 0.45,
    trunk: 0.24,
    green: 0.3,
    shade: 1.05,
  },
  // Young: short, three tiers.
  {
    salt: 4,
    tiers: 3,
    foot: 0.6,
    top: 3.4,
    reach: 1.2,
    topReach: 0.55,
    trunk: 0.16,
    green: 0.8,
    shade: 1.08,
  },
  // Snow-laden: full tiers buried nearly to their tips, drooping.
  {
    salt: 5,
    tiers: 5,
    foot: 0.95,
    top: 5.6,
    reach: 1.7,
    topReach: 0.45,
    snow: 0.88,
    droop: 0.2,
    trunk: 0.25,
    green: 0.2,
    shade: 0.9,
  },
  // Sparse: tiers apart, a light dusting.
  {
    salt: 6,
    tiers: 4,
    foot: 1.4,
    top: 5.6,
    reach: 1.45,
    topReach: 0.5,
    overlap: 1.15,
    snow: 0.58,
    trunk: 0.2,
    green: 0.65,
    shade: 1,
  },
  // Columnar: many small tiers, slim as a spire.
  {
    salt: 7,
    tiers: 7,
    foot: 0.8,
    top: 6.9,
    reach: 1.0,
    topReach: 0.34,
    fullness: 0.7,
    trunk: 0.2,
    green: 0.0,
    shade: 0.88,
  },
  // Lopsided: each tier shifted the other way from the last.
  {
    salt: 8,
    tiers: 5,
    foot: 1.0,
    top: 5.7,
    reach: 1.6,
    topReach: 0.5,
    sway: 0.2,
    trunk: 0.23,
    green: 0.45,
    shade: 1.02,
  },
  // Squat: three wide tiers heavy with snow.
  {
    salt: 9,
    tiers: 3,
    foot: 0.8,
    top: 4.0,
    reach: 2.0,
    topReach: 0.85,
    snow: 0.82,
    trunk: 0.26,
    green: 0.9,
    shade: 0.97,
  },
  // Laden giant: six broad tiers buried to their tips, drooping hard.
  {
    salt: 10,
    tiers: 6,
    foot: 1.0,
    top: 7.2,
    reach: 1.9,
    topReach: 0.42,
    snow: 0.95,
    droop: 0.26,
    trunk: 0.28,
    green: 0.25,
    shade: 0.92,
  },
  // White spire: eight narrow tiers all but white.
  {
    salt: 11,
    tiers: 8,
    foot: 1.1,
    top: 7.6,
    reach: 1.2,
    topReach: 0.3,
    fullness: 0.8,
    snow: 0.93,
    trunk: 0.21,
    green: 0.4,
    shade: 0.95,
  },
  // Chunky: four faceted tiers of five jagged tips, each a little off centre, under thick snow.
  {
    salt: 12,
    tiers: 4,
    foot: 0.9,
    top: 5.6,
    reach: 1.75,
    topReach: 0.55,
    tips: 5,
    jag: 0.28,
    notch: 0.76,
    offset: 0.14,
    overlap: 1.5,
    snow: 0.86,
    droop: 0.2,
    trunk: 0.25,
    green: 0.2,
    shade: 0.96,
  },
  // Chunky and slim: six tiers of five tips.
  {
    salt: 13,
    tiers: 6,
    foot: 1.0,
    top: 6.8,
    reach: 1.3,
    topReach: 0.4,
    tips: 5,
    jag: 0.25,
    notch: 0.74,
    offset: 0.1,
    overlap: 1.45,
    snow: 0.84,
    droop: 0.18,
    trunk: 0.22,
    green: 0.55,
    shade: 1,
  },
  // Chunky and squat: three wide jagged tiers, all but buried.
  {
    salt: 14,
    tiers: 3,
    foot: 0.7,
    top: 4.2,
    reach: 1.95,
    topReach: 0.7,
    tips: 6,
    jag: 0.3,
    notch: 0.72,
    offset: 0.16,
    overlap: 1.4,
    snow: 0.9,
    trunk: 0.26,
    green: 0.7,
    shade: 0.98,
  },
  // Bent top: the upper tiers swing well off the trunk's line.
  {
    salt: 15,
    tiers: 6,
    foot: 1.0,
    top: 6.4,
    reach: 1.45,
    topReach: 0.4,
    lean: 0.9,
    sway: 0.08,
    trunk: 0.22,
    green: 0.35,
    shade: 1,
  },
  // Wide cone: a broad foot drawing in fast near the top.
  {
    salt: 16,
    tiers: 5,
    foot: 0.8,
    top: 5.2,
    reach: 2.1,
    topReach: 0.5,
    fullness: 1.5,
    trunk: 0.28,
    green: 0.1,
    shade: 0.94,
  },
  // Needle: nine thin tiers on a tall stem.
  {
    salt: 17,
    tiers: 9,
    foot: 1.3,
    top: 8.0,
    reach: 1.0,
    topReach: 0.25,
    snow: 0.7,
    trunk: 0.2,
    green: 0.6,
    shade: 1,
  },
  // Dusted: short and full, snow only on the tops of the tiers.
  {
    salt: 18,
    tiers: 4,
    foot: 0.9,
    top: 4.6,
    reach: 1.5,
    topReach: 0.5,
    snow: 0.55,
    trunk: 0.22,
    green: 0.75,
    shade: 1.04,
  },
];
