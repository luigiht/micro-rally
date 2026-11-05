import { sanitizeUpgrades, type UpgradeLevels } from '../economy/upgrades';
import { isCatalogCar, type CatalogCarId } from '../economy/cars';
import { isCircuitStage, REGION_CYCLE } from '../stage/regions';
import { isValidGameId } from './GameId';

export interface StageRecord {
  best: number;
  splits: number[];
}

export const SAVE_VERSION = 4;
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

/** A Coast stage of the cycle (never a circuit). */
function isCoastStage(index: number): boolean {
  return !isCircuitStage(index) && REGION_CYCLE[index % REGION_CYCLE.length] === 'coast';
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
  if (raw.version === SAVE_VERSION) return parseCurrent(raw);
  return null;
}

/** Newest of the given saves, ignoring nulls. */
export function newestSave(...saves: readonly (SaveFile | null)[]): SaveFile | null {
  let best: SaveFile | null = null;
  for (const s of saves) if (s && (!best || s.updatedAt > best.updatedAt)) best = s;
  return best;
}
