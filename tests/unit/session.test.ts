import { describe, expect, it } from 'vitest';
import {
  checkResult,
  parseResultInput,
  parseSessionView,
  sessionOver,
  sessionStage,
  stageToDrive,
  type SessionResult,
  type SessionView,
} from '@/game/multiplayer/Session';

const run = (stageIndex: number, playerId: string, time: number | null = 100): SessionResult => ({
  stageIndex,
  playerId,
  time,
  splits: time === null ? [] : [time / 2],
});

function view(results: SessionResult[] = [], players = ['a', 'b']): SessionView {
  return {
    id: 'ABCD2345',
    seed: 7,
    stageCount: 3,
    carId: 'hatchback',
    createdAt: 1,
    players: players.map((id, seat) => ({ id, name: id.toUpperCase(), seat })),
    results,
  };
}

describe('session progress', () => {
  it('stays on a stage until both drivers have a result for it', () => {
    expect(sessionStage(view())).toBe(0);
    expect(sessionStage(view([run(0, 'a')]))).toBe(0);
    expect(sessionStage(view([run(0, 'a'), run(0, 'b')]))).toBe(1);
    // A retirement counts as having run the stage.
    expect(sessionStage(view([run(0, 'a'), run(0, 'b', null)]))).toBe(1);
  });

  it('waits for a second driver who has not joined yet', () => {
    const solo = view([run(0, 'a')], ['a']);
    expect(sessionStage(solo)).toBe(0);
    expect(stageToDrive(solo, 'a')).toBeNull();
  });

  it('tells each driver whether it is their turn', () => {
    const v = view([run(0, 'a')]);
    expect(stageToDrive(v, 'a')).toBeNull();
    expect(stageToDrive(v, 'b')).toBe(0);
  });

  it('is over once every stage has both results', () => {
    const all = [0, 1, 2].flatMap((i) => [run(i, 'a'), run(i, 'b')]);
    expect(sessionStage(view(all))).toBe(3);
    expect(sessionOver(view(all))).toBe(true);
    expect(stageToDrive(view(all), 'a')).toBeNull();
  });
});

describe('checkResult', () => {
  const par = 120;

  it('accepts a first, plausible run of the current stage', () => {
    expect(checkResult(view(), 'a', { stageIndex: 0, time: 110, splits: [30, 70] }, par)).toBe(
      null,
    );
    expect(checkResult(view(), 'a', { stageIndex: 0, time: null, splits: [] }, par)).toBeNull();
  });

  it('refuses other stages, second runs and finished sessions', () => {
    expect(checkResult(view(), 'a', { stageIndex: 1, time: 110, splits: [] }, par)).toBe(
      'not_current',
    );
    expect(
      checkResult(view([run(0, 'a')]), 'a', { stageIndex: 0, time: 90, splits: [] }, par),
    ).toBe('duplicate');
    const all = [0, 1, 2].flatMap((i) => [run(i, 'a'), run(i, 'b')]);
    expect(checkResult(view(all), 'a', { stageIndex: 3, time: 90, splits: [] }, par)).toBe('over');
  });

  it('refuses implausible times and splits', () => {
    const v = view();
    expect(checkResult(v, 'a', { stageIndex: 0, time: 20, splits: [] }, par)).toBe('invalid_time');
    expect(checkResult(v, 'a', { stageIndex: 0, time: 4000, splits: [] }, par)).toBe(
      'invalid_time',
    );
    expect(checkResult(v, 'a', { stageIndex: 0, time: 100, splits: [50, 40] }, par)).toBe(
      'invalid_splits',
    );
    expect(checkResult(v, 'a', { stageIndex: 0, time: 100, splits: [101] }, par)).toBe(
      'invalid_splits',
    );
    expect(checkResult(v, 'a', { stageIndex: 0, time: null, splits: [3] }, par)).toBe(
      'invalid_splits',
    );
  });
});

describe('parsing', () => {
  it('reads a result body and refuses malformed ones', () => {
    expect(parseResultInput({ stageIndex: 2, time: 99.5, splits: [1, 2] })).toEqual({
      stageIndex: 2,
      time: 99.5,
      splits: [1, 2],
    });
    expect(parseResultInput({ stageIndex: 0, time: null, splits: [] })?.time).toBeNull();
    expect(parseResultInput({ stageIndex: -1, time: 1, splits: [] })).toBeNull();
    expect(parseResultInput({ stageIndex: 0, time: '1', splits: [] })).toBeNull();
    expect(parseResultInput({ stageIndex: 0, time: 1, splits: ['x'] })).toBeNull();
    expect(parseResultInput([])).toBeNull();
  });

  it('round-trips a session view and sorts players by seat', () => {
    const v = view([run(0, 'a')]);
    const shuffled = { ...v, players: [...v.players].reverse() };
    expect(parseSessionView(JSON.parse(JSON.stringify(shuffled)))).toEqual(v);
  });

  it('refuses a view with a bad ID, length or car', () => {
    expect(parseSessionView({ ...view(), id: 'nope' })).toBeNull();
    expect(parseSessionView({ ...view(), stageCount: 4 })).toBeNull();
    expect(parseSessionView({ ...view(), carId: 'tank' })).toBeNull();
    expect(parseSessionView({ ...view(), results: [{ stageIndex: 0 }] })).toBeNull();
  });
});
