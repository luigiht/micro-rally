/**
 * The Arctic's tall spruces (`SpruceGeometry`), one spec a silhouette, after
 * the low-poly snowy spruces in `context/low-poly-tall-snowy-trees`: tiers of
 * thick slabs, lopsided and tilted, most of them green with snow over the
 * inner part of each tier's top, about a quarter laden to their rims, a few
 * bare; 12–14.5 m tall.
 */
export interface SpruceSpec {
  /** Salt for the tree's own irregularities. */
  salt: number;
  tiers: number;
  /** The lowest tier's rim height, and the top of the crown's stub. */
  foot: number;
  top: number;
  /** The lowest and the highest tier's reach, and the curve between them (1 straight, more for a fuller middle). */
  reach: number;
  topReach: number;
  fullness?: number;
  /** A tier's slab edge: how thick its rim stands. */
  thickness: number;
  /** Points round a tier's rim, and how far each strays from the tier's reach (a share of it). */
  spokes: number;
  jag: number;
  /** One side of every tier this much shorter than the other (a share of the reach): lopsided. */
  lopside?: number;
  /** Each tier set up to this far off the trunk's line, and tipped up to this slope. */
  offset: number;
  tilt: number;
  /** The rim's tips droop this share of the reach. */
  droop: number;
  /** A tier's height over the spacing between tiers (1.55 by default): less leaves gaps where the trunk shows. */
  overlap?: number;
  /** Snow: 0 none, a dusting on the tiers' tops toward 0.5, laden toward 1 (to the rims, hanging down them). */
  snow: number;
  /** The share of the wall's spruces that take this silhouette (the shares sum to 1). */
  share: number;
  /** The crown's top sideways shift, growing up the tree. */
  lean?: number;
  /** Stubs of old branches along a bare trunk below a high crown. */
  stubs?: number;
  /** The trunk's foot radius; where between the two pine greens this tree's green lies, and its brightness. */
  trunk: number;
  green: number;
  shade: number;
}

export const SPRUCE_SPECS: readonly SpruceSpec[] = [
  // Full: nine broad tiers, green with snow over the inner part of each top (the commonest).
  {
    salt: 1,
    tiers: 9,
    foot: 1.2,
    top: 13.4,
    reach: 2.05,
    topReach: 0.57,
    thickness: 0.39,
    spokes: 8,
    jag: 0.2,
    offset: 0.16,
    tilt: 0.08,
    droop: 0.15,
    snow: 0.7,
    share: 0.25,
    trunk: 0.3,
    green: 0.2,
    shade: 0.95,
  },
  // Slim and tall: eleven narrow tiers, green with snow on their tops.
  {
    salt: 2,
    tiers: 11,
    foot: 1.4,
    top: 14.4,
    reach: 1.6,
    topReach: 0.47,
    fullness: 1.3,
    thickness: 0.31,
    spokes: 8,
    jag: 0.18,
    offset: 0.12,
    tilt: 0.07,
    droop: 0.175,
    snow: 0.7,
    share: 0.2,
    trunk: 0.26,
    green: 0.5,
    shade: 1,
  },
  // Lopsided: every tier shorter on one side, shifted and tipped, snow on its tops.
  {
    salt: 3,
    tiers: 9,
    foot: 1.1,
    top: 12.8,
    reach: 2.15,
    topReach: 0.57,
    thickness: 0.36,
    spokes: 8,
    jag: 0.22,
    lopside: 0.35,
    offset: 0.24,
    tilt: 0.1,
    droop: 0.15,
    snow: 0.75,
    share: 0.18,
    trunk: 0.28,
    green: 0.3,
    shade: 0.97,
  },
  // High-crowned: a bare trunk with stubs of old branches, the crown well up it.
  {
    salt: 4,
    tiers: 8,
    foot: 4.6,
    top: 14.2,
    reach: 1.65,
    topReach: 0.47,
    thickness: 0.34,
    spokes: 8,
    jag: 0.2,
    offset: 0.14,
    tilt: 0.08,
    droop: 0.175,
    snow: 0.95,
    share: 0.1,
    stubs: 6,
    trunk: 0.27,
    green: 0.4,
    shade: 0.95,
  },
  // Gappy: seven tiers apart, the trunk showing between, a dusting on their tops.
  {
    salt: 5,
    tiers: 7,
    foot: 1.6,
    top: 12.4,
    reach: 1.95,
    topReach: 0.57,
    thickness: 0.34,
    spokes: 8,
    jag: 0.22,
    offset: 0.18,
    tilt: 0.09,
    droop: 0.225,
    overlap: 1.08,
    snow: 0.5,
    share: 0.05,
    trunk: 0.26,
    green: 0.65,
    shade: 1.02,
  },
  // Plain and full: no snow (rare).
  {
    salt: 6,
    tiers: 9,
    foot: 1.0,
    top: 12.6,
    reach: 2.1,
    topReach: 0.57,
    thickness: 0.36,
    spokes: 8,
    jag: 0.2,
    offset: 0.16,
    tilt: 0.08,
    droop: 0.163,
    snow: 0,
    share: 0.03,
    trunk: 0.29,
    green: 0.1,
    shade: 0.95,
  },
  // Plain, slim and leaning (rare).
  {
    salt: 7,
    tiers: 10,
    foot: 1.3,
    top: 13.8,
    reach: 1.7,
    topReach: 0.5,
    thickness: 0.33,
    spokes: 8,
    jag: 0.2,
    lopside: 0.15,
    offset: 0.14,
    tilt: 0.08,
    droop: 0.188,
    lean: 0.5,
    snow: 0,
    share: 0.03,
    trunk: 0.26,
    green: 0.6,
    shade: 1,
  },
  // Laden: the full tree buried to its rims, snow hanging down them.
  {
    salt: 8,
    tiers: 9,
    foot: 1.2,
    top: 13.6,
    reach: 2.1,
    topReach: 0.57,
    thickness: 0.39,
    spokes: 8,
    jag: 0.2,
    offset: 0.18,
    tilt: 0.08,
    droop: 0.15,
    snow: 1,
    share: 0.16,
    trunk: 0.3,
    green: 0.25,
    shade: 0.95,
  },
];
