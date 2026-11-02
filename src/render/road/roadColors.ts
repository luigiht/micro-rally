import type { Surface } from '@/game/vehicle/surfaces';

/** Daytime carriageway colour per surface. */
export const ROAD_COLORS: Readonly<Record<Surface, string>> = {
  tarmac: '#55565e',
  gravel: '#a98e68',
  mud: '#6b4d33',
  /** Snow stages are asphalt under drifting snow: this is the dusting, blended over tarmac. */
  snow: '#e9eef2',
  grass: '#8fbf6a',
};
/** White edge lines, 2 cm over the deck. */
export const LINE_COLOR = '#f4f1e8';
/** Through a town the verges become pavements: pale concrete standing a kerb's height above the road. */
export const PAVEMENT_COLOR = '#a6a39b';
/** The kerb's vertical face, a shade darker than the pavement it carries. */
export const KERB_COLOR = '#8d8a82';
/** Verge marker posts every 20 m: white post, orange cap. */
export const POST_COLOR = '#f4f1e8';
export const CAP_COLOR = '#e8623a';
