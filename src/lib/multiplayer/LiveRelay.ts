import {
  GhostTrack,
  LIVE_STALE_MS,
  LiveOutbox,
  parseLiveRecord,
  type LiveRecord,
} from '@/game/multiplayer/LiveTrack';
import type { VehiclePose } from '@/game/vehicle/interpolatePose';
import type { SessionSeat } from './SessionClient';

/** While the other driver is on the stage: an exchange every quarter second. */
const LIVE_MS = 250;
/** While they aren't: once a second, enough to notice them arrive. */
const IDLE_MS = 1000;
/** After a failed exchange. */
const RETRY_MS = 2000;
const TIMEOUT_MS = 4000;

/** What the HUD shows of the other driver: where they are on the stage, or nothing. */
export interface LivePresence {
  present: boolean;
  /** Progress of their newest sample, 0..1. */
  progress: number;
}

interface Target {
  sessionId: string;
  seat: SessionSeat;
  stageIndex: number;
}

function newRunId(): string {
  const buf = new Uint32Array(2);
  globalThis.crypto.getRandomValues(buf);
  return `${buf[0]!.toString(36)}${buf[1]!.toString(36)}`;
}

/**
 * The client half of live positions: while this driver is on a session
 * stage it records their car into the outbox every frame, swaps windows
 * with the server on a timer, and feeds the other driver's windows into the
 * ghost track that the scene plays back. Only the other driver's windows
 * for the same stage count; anything else clears the ghost.
 */
export class LiveRelay {
  readonly outbox = new LiveOutbox();
  readonly ghost = new GhostTrack();
  private target: Target | null = null;
  private run = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private lastHeard = 0;
  private presence: LivePresence = { present: false, progress: 0 };

  constructor(
    private readonly onPresence: (p: LivePresence) => void,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly baseUrl = '/api/sessions',
    private readonly now: () => number = Date.now,
  ) {}

  get active(): boolean {
    return this.target !== null;
  }

  /** The other driver is on this stage right now. */
  get present(): boolean {
    return this.presence.present;
  }

  /** Start relaying a run of `stageIndex` (a restart is a new run). */
  start(sessionId: string, seat: SessionSeat, stageIndex: number): void {
    this.stop();
    this.target = { sessionId, seat, stageIndex };
    this.run = newRunId();
    this.schedule(0);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.abort?.abort();
    this.abort = null;
    this.target = null;
    this.outbox.clear();
    this.ghost.clear();
    this.setPresence(false, 0);
  }

  /** Every frame while driving: the car at run clock `t`. Cheap when no sample is due. */
  record(t: number, pose: Readonly<VehiclePose>, brake: number, progress: () => number): void {
    if (!this.target || !this.outbox.due(t)) return;
    this.outbox.push(t, pose, brake, progress());
  }

  private schedule(ms: number): void {
    this.timer = setTimeout(() => void this.exchange(), ms);
  }

  private setPresence(present: boolean, progress: number): void {
    if (present === this.presence.present && progress === this.presence.progress) return;
    this.presence = { present, progress };
    this.onPresence(this.presence);
  }

  private async exchange(): Promise<void> {
    const target = this.target;
    if (!target) return;
    const started = this.now();
    const abort = new AbortController();
    this.abort = abort;
    const timeout = setTimeout(() => abort.abort(), TIMEOUT_MS);
    let other: LiveRecord | null = null;
    let ok = false;
    try {
      const res = await this.fetchFn(`${this.baseUrl}/${target.sessionId}/live`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...target.seat,
          stageIndex: target.stageIndex,
          run: this.run,
          samples: this.outbox.window(),
        }),
        cache: 'no-store',
        signal: abort.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as { other?: unknown };
        other = json.other == null ? null : parseLiveRecord(json.other);
        ok = true;
      }
    } catch {
      // Offline, timed out or stopped: handled below.
    } finally {
      clearTimeout(timeout);
    }
    if (this.target !== target) return;
    this.abort = null;

    if (ok) {
      this.lastHeard = started;
      if (other && other.stageIndex === target.stageIndex && other.samples.length > 0) {
        this.ghost.ingest(other.run, other.samples);
        // Progress is the last field, so the window's last number is the newest sample's.
        this.setPresence(true, other.samples[other.samples.length - 1]!);
      } else {
        this.ghost.clear();
        this.setPresence(false, 0);
      }
    } else if (this.now() - this.lastHeard > LIVE_STALE_MS) {
      this.ghost.clear();
      this.setPresence(false, 0);
    }
    const wait = !ok ? RETRY_MS : this.presence.present ? LIVE_MS : IDLE_MS;
    this.schedule(Math.max(0, wait - (this.now() - started)));
  }
}
