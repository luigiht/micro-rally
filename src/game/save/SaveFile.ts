import { sanitizeUpgrades, type UpgradeLevels } from '../economy/upgrades';
import { isCatalogCar, type CatalogCarId } from '../economy/cars';
import { stageSlot, type StageTypeId } from '../stage/regions';
import { isValidGameId } from './GameId';

export interface StageRecord {
  best: number;
  splits: number[];
}

export const SAVE_VERSION = 11;
export const DRIVER_NAME_MAX = 24;

/** Everything needed to resume a game. Nothing personal beyond the driver name. */
export interface SaveFile {
  version: typeof SAVE_VERSION;
  gameId: string;
  driverName: string;
  gameSeed: number;
  money: number;
  stageIndex: number;
  records: Record<number, StageRecord>;
  carId: CatalogCarId;
  ownedCars: CatalogCarId[];
  upgrades: UpgradeLevels;
  /** ms since epoch; newest wins when local and online copies differ. */
  updatedAt: number;
}

/** Trim, collapse inner whitespace, cap length. */
export function sanitizeDriverName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, DRIVER_NAME_MAX);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseRecords(v: unknown): Record<number, StageRecord> | null {
  if (!isRecord(v)) return null;
  const out: Record<number, StageRecord> = {};
  for (const [key, rec] of Object.entries(v)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || !isRecord(rec)) return null;
    if (!finite(rec.best) || !Array.isArray(rec.splits) || !rec.splits.every(finite)) return null;
    out[index] = { best: rec.best, splits: [...(rec.splits as number[])] };
  }
  return out;
}

/** v1 saves predate the garage: they drove the hatchback with no upgrades. */
function migrateV1(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, version: 2, carId: 'hatchback', ownedCars: ['hatchback'], upgrades: {} };
}

/** Every tenth stage, the circuits' slot before the cities claimed the clashes (v7). */
function isCircuitStage(index: number): boolean {
  return index % 10 === 9;
}

/**
 * v2 saves predate the circuits: every tenth stage was an
 * open road then, and a best time set there says nothing about the race
 * that stands in its place now, so those records are dropped.
 */
function migrateV2(raw: Record<string, unknown>): Record<string, unknown> {
  const records = isRecord(raw.records) ? raw.records : {};
  const kept = Object.fromEntries(
    Object.entries(records).filter(([key]) => !isCircuitStage(Number(key))),
  );
  return { ...raw, version: 3, records: kept };
}

type LegacyRegionId = 'forest' | 'coast' | 'desert' | 'alpine' | 'urban' | 'arctic';
type LegacyStageId = LegacyRegionId | 'circuit';

/** The twelve-stage region cycle of v2–v4 saves, which v5's fifteen-stage cycle with the cities replaced. */
const CYCLE_V4: readonly LegacyRegionId[] = [
  'forest',
  'forest',
  'alpine',
  'alpine',
  'coast',
  'forest',
  'desert',
  'coast',
  'alpine',
  'coast',
  'desert',
  'desert',
];

/** A Coast stage of the v4 cycle (never a circuit). */
function isCoastStage(index: number): boolean {
  return !isCircuitStage(index) && CYCLE_V4[index % CYCLE_V4.length] === 'coast';
}

/** The fifteen-stage cycle of v5 saves, which v6's eighteen-stage cycle with the Arctic replaced. */
const CYCLE_V5: readonly LegacyRegionId[] = [
  'forest',
  'forest',
  'alpine',
  'alpine',
  'coast',
  'forest',
  'urban',
  'desert',
  'alpine',
  'desert',
  'urban',
  'coast',
  'urban',
  'coast',
  'desert',
];

/** The eighteen-stage cycle of v6 saves, which v7's fixed city and circuit slots and rally mix replaced. */
const CYCLE_V6: readonly LegacyRegionId[] = [
  'forest',
  'forest',
  'alpine',
  'arctic',
  'coast',
  'forest',
  'urban',
  'desert',
  'alpine',
  'alpine',
  'urban',
  'coast',
  'urban',
  'arctic',
  'desert',
  'coast',
  'desert',
  'arctic',
];

/** A stage whose region differs between two cycles (never a circuit, which sits outside both). */
function regionChanged(
  index: number,
  from: readonly LegacyRegionId[],
  to: readonly LegacyRegionId[],
): boolean {
  return !isCircuitStage(index) && from[index % from.length] !== to[index % to.length];
}

/**
 * v3 saves predate the per-stage coast roads (mirrored shores, their own bays
 * and headlands): every Coast stage drives a different road now, so the best
 * times set there are dropped, as the circuits' were.
 */
function migrateV3(raw: Record<string, unknown>): Record<string, unknown> {
  const records = isRecord(raw.records) ? raw.records : {};
  const kept = Object.fromEntries(
    Object.entries(records).filter(([key]) => !isCoastStage(Number(key))),
  );
  return { ...raw, version: 4, records: kept };
}

/**
 * v4 saves predate the cities: the region cycle grew from twelve stages to
 * fifteen, so from stage 7 on many indices are another region's road now
 * (the first city stands where the first Desert was). Records at every index
 * whose region changed are dropped; the rest keep their meaning.
 */
function migrateV4(raw: Record<string, unknown>): Record<string, unknown> {
  const records = isRecord(raw.records) ? raw.records : {};
  const kept = Object.fromEntries(
    Object.entries(records).filter(([key]) => !regionChanged(Number(key), CYCLE_V4, CYCLE_V5)),
  );
  return { ...raw, version: 5, records: kept };
}

/**
 * v5 saves predate the Arctic: the region cycle grew from fifteen stages to
 * eighteen, so from stage 4 on many indices are another region's road now
 * (the first Arctic stands where the second Alpine was). Records at every
 * index whose region changed are dropped; the rest keep their meaning.
 */
function migrateV5(raw: Record<string, unknown>): Record<string, unknown> {
  const records = isRecord(raw.records) ? raw.records : {};
  const kept = Object.fromEntries(
    Object.entries(records).filter(([key]) => !regionChanged(Number(key), CYCLE_V5, CYCLE_V6)),
  );
  return { ...raw, version: 6, records: kept };
}

/**
 * v6 saves predate the fixed schedule: a city every ninth stage, a circuit
 * every tenth (the city keeping any clash) and a seven-stage rally mix
 * between them with Forest's surface fixed per slot. Records are kept only
 * where the stage is still the same region; Forest's are dropped too, since
 * a Forest stage's surface was drawn before and is fixed now.
 */
function migrateV6(raw: Record<string, unknown>): Record<string, unknown> {
  const records = isRecord(raw.records) ? raw.records : {};
  const kept = Object.fromEntries(
    Object.entries(records).filter(([key]) => {
      const index = Number(key);
      const before = isCircuitStage(index) ? 'circuit' : CYCLE_V6[index % CYCLE_V6.length];
      const now = stageSlot(index);
      const previousRegion: Readonly<Record<StageTypeId, LegacyStageId>> = {
        arctic: 'arctic',
        circuit: 'circuit',
        autumnal: 'forest',
        pinewood: 'forest',
        alpine: 'alpine',
        forest: 'forest',
        urban: 'urban',
        coastal: 'coast',
        desert: 'desert',
      };
      const oldSurfaceWasFixed = now === 'autumnal' || now === 'pinewood' || now === 'forest';
      return previousRegion[now] === before && !oldSurfaceWasFixed;
    }),
  );
  return { ...raw, version: 7, records: kept };
}

/** v9 lays every city on a street map with a tram loop: the old cities' roads are gone, and so are their records. */
function migrateV8(raw: Record<string, unknown>): Record<string, unknown> {
  const records = isRecord(raw.records) ? raw.records : {};
  const kept = Object.fromEntries(
    Object.entries(records).filter(([key]) => stageSlot(Number(key)) !== 'urban'),
  );
  return { ...raw, version: 9, records: kept };
}

/** v11 squares every city corner (tighter arcs) and draws two- and four-lane streets only: the cities' records go again. */
function migrateV10(raw: Record<string, unknown>): Record<string, unknown> {
  const records = isRecord(raw.records) ? raw.records : {};
  const kept = Object.fromEntries(
    Object.entries(records).filter(([key]) => stageSlot(Number(key)) !== 'urban'),
  );
  return { ...raw, version: 11, records: kept };
}

/** v10 plans every city with two or three roundabouts and a tram loop it crosses four times: new routes, so the cities' records go. */
function migrateV9(raw: Record<string, unknown>): Record<string, unknown> {
  const records = isRecord(raw.records) ? raw.records : {};
  const kept = Object.fromEntries(
    Object.entries(records).filter(([key]) => stageSlot(Number(key)) !== 'urban'),
  );
  return { ...raw, version: 10, records: kept };
}

/** v8 fixes Alpine stages to snow; prior Alpine records may be for tarmac. */
function migrateV7(raw: Record<string, unknown>): Record<string, unknown> {
  const records = isRecord(raw.records) ? raw.records : {};
  const kept = Object.fromEntries(
    Object.entries(records).filter(([key]) => stageSlot(Number(key)) !== 'alpine'),
  );
  return { ...raw, version: 8, records: kept };
}

function parseCurrent(raw: Record<string, unknown>): SaveFile | null {
  if (typeof raw.gameId !== 'string' || !isValidGameId(raw.gameId)) return null;
  if (typeof raw.driverName !== 'string') return null;
  if (!finite(raw.gameSeed) || !finite(raw.money) || !finite(raw.stageIndex)) return null;
  if (!finite(raw.updatedAt)) return null;
  const records = parseRecords(raw.records ?? {});
  if (!records) return null;
  if (!Array.isArray(raw.ownedCars) || !isRecord(raw.upgrades ?? {})) return null;
  const owned = raw.ownedCars.filter(
    (c): c is CatalogCarId => typeof c === 'string' && isCatalogCar(c),
  );
  if (!owned.includes('hatchback')) owned.unshift('hatchback');
  const carId =
    typeof raw.carId === 'string' && isCatalogCar(raw.carId) && owned.includes(raw.carId)
      ? raw.carId
      : 'hatchback';
  return {
    version: SAVE_VERSION,
    gameId: raw.gameId,
    driverName: sanitizeDriverName(raw.driverName),
    gameSeed: raw.gameSeed >>> 0,
    money: Math.max(0, Math.round(raw.money)),
    stageIndex: Math.max(0, Math.floor(raw.stageIndex)),
    records,
    carId,
    ownedCars: [...new Set(owned)],
    upgrades: sanitizeUpgrades((raw.upgrades ?? {}) as Record<string, unknown>),
    updatedAt: raw.updatedAt,
  };
}

/**
 * Validate (and, for older versions, migrate) parsed JSON into a SaveFile.
 * Returns null for anything malformed rather than throwing: a bad save must
 * never take the game down.
 */
export function parseSaveFile(data: unknown): SaveFile | null {
  if (!isRecord(data)) return null;
  let raw = data;
  if (raw.version === 1) raw = migrateV1(raw);
  if (raw.version === 2) raw = migrateV2(raw);
  if (raw.version === 3) raw = migrateV3(raw);
  if (raw.version === 4) raw = migrateV4(raw);
  if (raw.version === 5) raw = migrateV5(raw);
  if (raw.version === 6) raw = migrateV6(raw);
  if (raw.version === 7) raw = migrateV7(raw);
  if (raw.version === 8) raw = migrateV8(raw);
  if (raw.version === 9) raw = migrateV9(raw);
  if (raw.version === 10) raw = migrateV10(raw);
  if (raw.version === SAVE_VERSION) return parseCurrent(raw);
  return null;
}

/** Newest of the given saves, ignoring nulls. */
export function newestSave(...saves: readonly (SaveFile | null)[]): SaveFile | null {
  let best: SaveFile | null = null;
  for (const s of saves) if (s && (!best || s.updatedAt > best.updatedAt)) best = s;
  return best;
}
