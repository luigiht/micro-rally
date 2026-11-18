import { CAR_CATALOG, type CatalogCarId } from '@/game/economy/cars';
import type { StageTypeId } from '@/game/stage/regions';

/** A file in `public/landing`, the landing page's images and icons. */
export const landingAsset = (name: string) => `/landing/${name}`;

/** The stage types the page shows, in its order; each has `stage-<id>.png` and a note in `landing.worlds.stages`. */
export const LANDING_STAGES = [
  'pinewood',
  'arctic',
  'alpine',
  'coastal',
  'urban',
  'desert',
  'forest',
  'circuit',
] as const satisfies readonly StageTypeId[];

/**
 * The cars the garage section shows: the whole dealership, in its order. Each
 * turns live on the page; `car-<id>.png` is its still (the poster and
 * thumbnail) and `landing.garage.types` names its class.
 */
export const LANDING_CARS: readonly CatalogCarId[] = CAR_CATALOG.map((car) => car.id);

/** The camera views' screenshots (`camera-<view>.webp`), in the order of `landing.cameras.names`. */
export const CAMERA_VIEWS = ['chase', 'interior', 'isometric', 'cinematic'] as const;

/** Icons for the three "how it plays" steps and the three features, in message order. */
export const STEP_ICONS = ['icon-step-stage.svg', 'icon-step-flow.svg', 'icon-step-garage.svg'];
export const FEATURE_ICONS = ['icon-procedural.svg', 'icon-friend.svg', 'icon-stages.svg'];

/** Where Play goes: the game itself, on this site. */
export const PLAY_HREF = '/game';

/** "01", "02"… as the design numbers its cards. */
export const twoDigits = (n: number) => String(n).padStart(2, '0');
