import { describe, it, expect, vi } from 'vitest';
import { gameStore } from '@stores/game.store';

function fakePersist<T>(initial: T) {
  let value = initial;
  const wrapper = { valueOf: () => value } as unknown as T;
  return Object.assign(
    (v: T) => {
      value = v;
      return wrapper;
    },
    { as: (_key: string) => initial },
  ) as never;
}

describe('gameStore', () => {
  it('starts with an empty turn list and no session', () => {
    const store = gameStore(((initial: unknown) => ({ as: () => initial })) as never);
    expect(store.sessionId).toBeNull();
    expect(store.turns).toEqual([]);
  });

  it('startSession sets the session and config snapshot', () => {
    const store = gameStore(((initial: unknown) => ({ as: () => initial })) as never);
    store.startSession({
      gameTypeKey: 'SCORE_TRAINING',
      sessionId: 's1',
      participantRef: 'p1',
      configSnapshot: { durationType: 'ROUNDS', durationValue: 10, maxDartsPerTurn: 3 },
    });
    expect(store.sessionId).toBe('s1');
    expect(store.configSnapshot?.durationValue).toBe(10);
  });

  it('recordTurn appends a turn and reset() clears the session', () => {
    const store = gameStore(((initial: unknown) => ({ as: () => initial })) as never);
    store.startSession({
      gameTypeKey: 'SCORE_TRAINING',
      sessionId: 's1',
      participantRef: 'p1',
      configSnapshot: { durationType: 'ROUNDS', durationValue: 10, maxDartsPerTurn: 3 },
    });
    store.recordTurn({ clientKey: 't1', sequence: 1, totalScore: 45, completedAt: null });
    expect(store.turns).toHaveLength(1);
    store.reset();
    expect(store.sessionId).toBeNull();
    expect(store.turns).toEqual([]);
  });
});
