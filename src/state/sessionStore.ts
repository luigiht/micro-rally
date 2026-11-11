import { create } from 'zustand';
import type { CatalogCarId } from '@/game/economy/cars';
import {
  stageToDrive,
  type ResultInput,
  type SessionPlayer,
  type SessionView,
} from '@/game/multiplayer/Session';
import {
  SessionApiError,
  SessionClient,
  SessionSeats,
  writeSessionParam,
  type SessionSeat,
} from '@/lib/multiplayer/SessionClient';
import { useGameStore } from './gameStore';
import { useUiStore } from './uiStore';

export type SessionScreen = 'lobby' | 'drive';
/** The finished run's trip to the server. */
export type UploadState = 'idle' | 'sending' | 'saved' | 'failed';

interface SessionState {
  /** Null outside multiplayer. */
  session: SessionView | null;
  seat: SessionSeat | null;
  screen: SessionScreen;
  /** The stage index on the drive screen. */
  driving: number | null;
  upload: UploadState;
  /** The last refresh failed; the lobby says so and keeps polling. */
  offline: boolean;
}

const OUTSIDE: SessionState = {
  session: null,
  seat: null,
  screen: 'lobby',
  driving: null,
  upload: 'idle',
  offline: false,
};

/** Multiplayer: the session as last fetched, this device's seat and which screen shows. */
export const useSessionStore = create<SessionState>()(() => OUTSIDE);

/** The other driver in the session, once someone has taken the second seat. */
export function opponentOf(s: Pick<SessionState, 'session' | 'seat'>): SessionPlayer | null {
  return s.session?.players.find((p) => p.id !== s.seat?.playerId) ?? null;
}

let client: SessionClient | null = null;
let seats: SessionSeats | null = null;
/** The run being sent, kept so a failed upload can be retried. */
let pendingRun: ResultInput | null = null;

export function getSessionClient(): SessionClient {
  client ??= new SessionClient();
  return client;
}

/** This device's seats (Web Storage). Client-side only. */
export function getSessionSeats(): SessionSeats {
  seats ??= new SessionSeats(window.localStorage);
  return seats;
}

/** Open the lobby of a session this device holds a seat in. */
export function enterSession(session: SessionView, seat: SessionSeat): void {
  const local = getSessionSeats();
  local.set(session.id, seat);
  local.lastSessionId = session.id;
  writeSessionParam(session.id);
  pendingRun = null;
  useSessionStore.setState({ ...OUTSIDE, session, seat });
}

/** Back to the splash screen; the seat stays on this device so the session can be rejoined. */
export function leaveSession(): void {
  const ui = useUiStore.getState();
  ui.closePanel();
  ui.stopReplay();
  useGameStore.getState().leaveGame();
  writeSessionParam(null);
  pendingRun = null;
  useSessionStore.setState(OUTSIDE);
}

/** Fetch the latest state of the session; marks the lobby offline when that fails. */
export async function refreshSession(): Promise<void> {
  const id = useSessionStore.getState().session?.id;
  if (!id) return;
  try {
    const next = await getSessionClient().get(id);
    if (useSessionStore.getState().session?.id === id)
      useSessionStore.setState({ session: next, offline: false });
  } catch {
    if (useSessionStore.getState().session?.id === id) useSessionStore.setState({ offline: true });
  }
}

/**
 * Pick this driver's car for the whole session, once, before their first
 * stage. False when the server can't be reached; a car already picked (a
 * retry after a lost response) counts as picked.
 */
export async function chooseSessionCar(carId: CatalogCarId): Promise<boolean> {
  const { session, seat } = useSessionStore.getState();
  if (!session || !seat) return false;
  try {
    const next = await getSessionClient().chooseCar(session.id, seat, carId);
    useSessionStore.setState({ session: next, offline: false });
    return true;
  } catch (err) {
    if (err instanceof SessionApiError && err.code === 'car_set') {
      await refreshSession();
      return true;
    }
    return false;
  }
}

/**
 * Drive the stage the session is waiting on this driver for (again, to
 * restart a run that hasn't finished): the game store gets the session's
 * seed, stage and stage types, this driver's car, and no Game ID, so
 * nothing is saved to a solo game. False until the driver has a car.
 */
export function driveSessionStage(): boolean {
  const { session, seat } = useSessionStore.getState();
  if (!session || !seat) return false;
  const stage = stageToDrive(session, seat.playerId);
  if (stage === null) return false;
  const me = session.players.find((p) => p.id === seat.playerId);
  if (!me?.carId) return false;
  const carId = me.carId;
  useGameStore.setState((s) => ({
    gameId: null,
    driverName: me.name,
    gameSeed: session.seed,
    stageIndex: stage,
    stageTypes: session.stageTypes ?? null,
    attempt: s.attempt + 1,
    carId,
    ownedCars: [carId],
    upgrades: {},
    money: 0,
    records: {},
  }));
  const ui = useUiStore.getState();
  ui.closePanel();
  ui.stopReplay();
  pendingRun = null;
  useSessionStore.setState({ screen: 'drive', driving: stage, upload: 'idle' });
  return true;
}

export function backToLobby(): void {
  const ui = useUiStore.getState();
  ui.closePanel();
  ui.stopReplay();
  pendingRun = null;
  useSessionStore.setState({ screen: 'lobby', driving: null, upload: 'idle' });
  void refreshSession();
}

async function send(run: ResultInput): Promise<boolean> {
  const { session, seat } = useSessionStore.getState();
  if (!session || !seat) return false;
  pendingRun = run;
  useSessionStore.setState({ upload: 'sending' });
  try {
    const next = await getSessionClient().submit(session.id, seat, run);
    pendingRun = null;
    useSessionStore.setState({ session: next, upload: 'saved', offline: false });
    return true;
  } catch (err) {
    // Already counted (a retry after a lost response): the server has it, so it's saved.
    if (err instanceof SessionApiError && err.code === 'duplicate') {
      pendingRun = null;
      useSessionStore.setState({ upload: 'saved' });
      await refreshSession();
      return true;
    }
    useSessionStore.setState({ upload: 'failed' });
    return false;
  }
}

/** Count the finished run of the stage being driven: the first finish is the one that counts. */
export function submitRun(time: number, splits: readonly number[]): void {
  const { driving, upload } = useSessionStore.getState();
  if (driving === null || upload !== 'idle') return;
  void send({ stageIndex: driving, time, splits: [...splits] });
}

/** Send the run again after a failed upload. */
export function retryUpload(): void {
  if (pendingRun && useSessionStore.getState().upload === 'failed') void send(pendingRun);
}

/** Give up the stage being driven: no points, and the session can move on. */
export async function retireStage(): Promise<boolean> {
  const { driving } = useSessionStore.getState();
  if (driving === null) return false;
  const sent = await send({ stageIndex: driving, time: null, splits: [] });
  if (sent) backToLobby();
  return sent;
}
