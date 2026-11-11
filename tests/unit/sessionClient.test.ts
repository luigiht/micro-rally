import { describe, expect, it } from 'vitest';
import {
  readSessionParam,
  sessionLink,
  SessionApiError,
  SessionClient,
  SessionSeats,
} from '@/lib/multiplayer/SessionClient';

const session = {
  id: 'ABCD2345',
  seed: 1,
  stageCount: 3,
  createdAt: 1,
  stageTypes: ['alpine', 'arctic'],
  players: [{ id: 'p1', name: 'Ada', seat: 0, carId: null }],
  results: [],
};

function client(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json(body, { status });
  };
  return { api: new SessionClient(fetchFn, '/api/sessions'), calls };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (err) {
    return err instanceof SessionApiError ? err.code : 'other';
  }
}

describe('SessionClient', () => {
  it('creates a session and returns the seat', async () => {
    const { api, calls } = client(201, { session, playerId: 'p1', token: 't' });
    const seated = await api.create('Ada', 3, ['alpine', 'arctic']);
    expect(seated.seat).toEqual({ playerId: 'p1', token: 't' });
    expect(seated.session.players[0]!.name).toBe('Ada');
    expect(seated.session.stageTypes).toEqual(['alpine', 'arctic']);
    expect(calls[0]!.url).toBe('/api/sessions');
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({
      name: 'Ada',
      stageCount: 3,
      stageTypes: ['alpine', 'arctic'],
    });
  });

  it('joins with a name, then picks the car with the seat', async () => {
    const { api, calls } = client(201, { session, playerId: 'p2', token: 't2' });
    await api.join('ABCD2345', 'Bo');
    expect(calls[0]!.url).toBe('/api/sessions/ABCD2345/join');
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ name: 'Bo' });
    await api.chooseCar('ABCD2345', { playerId: 'p2', token: 't2' }, 'buggy');
    expect(calls[1]!.url).toBe('/api/sessions/ABCD2345/car');
    expect(JSON.parse(String(calls[1]!.init!.body))).toEqual({
      playerId: 'p2',
      token: 't2',
      carId: 'buggy',
    });
  });

  it('sends the seat with a run', async () => {
    const { api, calls } = client(200, { session });
    await api.submit(
      'ABCD2345',
      { playerId: 'p1', token: 't' },
      {
        stageIndex: 0,
        time: 90,
        splits: [40],
      },
    );
    expect(calls[0]!.url).toBe('/api/sessions/ABCD2345/results');
    expect(JSON.parse(String(calls[0]!.init!.body))).toMatchObject({ token: 't', time: 90 });
  });

  it('turns API errors into codes, and outages into `unavailable`', async () => {
    expect(await codeOf(client(404, { error: 'not_found' }).api.get('ABCD2345'))).toBe('not_found');
    expect(await codeOf(client(409, { error: 'full' }).api.join('ABCD2345', 'Bo'))).toBe('full');
    expect(await codeOf(client(500, { error: 'x' }).api.get('ABCD2345'))).toBe('unavailable');
    expect(await codeOf(client(503, { error: 'storage_unconfigured' }).api.get('ABCD2345'))).toBe(
      'unavailable',
    );
    expect(await codeOf(client(200, { session: { nope: 1 } }).api.get('ABCD2345'))).toBe(
      'unavailable',
    );
    const offline = new SessionClient(async () => {
      throw new TypeError('network');
    });
    expect(await codeOf(offline.get('ABCD2345'))).toBe('unavailable');
  });
});

describe('SessionSeats', () => {
  it('keeps seats per session and the last session and name', () => {
    const map = new Map<string, string>();
    const seats = new SessionSeats({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    });
    expect(seats.get('ABCD2345')).toBeNull();
    seats.set('ABCD2345', { playerId: 'p1', token: 't' });
    expect(seats.get('ABCD2345')).toEqual({ playerId: 'p1', token: 't' });
    seats.lastSessionId = 'ABCD2345';
    seats.lastName = 'Ada';
    expect(seats.lastSessionId).toBe('ABCD2345');
    expect(seats.lastName).toBe('Ada');
    map.set('micro-rally:session-seat:ZZZZ9999', '{broken');
    expect(seats.get('ZZZZ9999')).toBeNull();
  });
});

describe('session links', () => {
  it('reads ?session= tolerantly and builds a join link', () => {
    expect(readSessionParam('?session=abcd-2345')).toBe('ABCD2345');
    expect(readSessionParam('?session=nope')).toBeNull();
    expect(sessionLink('ABCD2345', 'https://micro.rally')).toBe(
      'https://micro.rally/?session=ABCD2345',
    );
  });
});
