import { describe, it, expect } from "vitest";
import type { Persist } from "@alpinejs/persist";
import { gameStore } from "@stores/game.store";

/**
 * Mirrors @alpinejs/persist: one persist() closure shares `alias` across .as()
 * calls; interceptors read alias when initialized (after all .as() calls).
 */
function createSharedAliasPersist() {
  let alias: string | undefined;
  const pendingInits: Array<() => string> = [];

  const persist = ((initial: unknown) => {
    pendingInits.push(() => alias ?? "");
    return {
      as(key: string) {
        alias = key;
        return initial;
      },
    };
  }) as Persist;

  return {
    persist,
    /** Simulate Alpine initializing interceptors after the store object is built */
    resolveAliases() {
      return pendingInits.map((fn) => fn());
    },
  };
}

function stubPersistFactory(): () => Persist {
  return () => ((initial: unknown) => ({ as: () => initial })) as Persist;
}

describe("gameStore", () => {
  it("starts with an empty turn list and no session", () => {
    const store = gameStore(stubPersistFactory());
    expect(store.sessionId).toBeNull();
    expect(store.turns).toEqual([]);
  });

  it("startSession sets the session and config snapshot", () => {
    const store = gameStore(stubPersistFactory());
    store.startSession({
      gameTypeKey: "SCORE_TRAINING",
      sessionId: "s1",
      participantRef: "p1",
      configSnapshot: {
        durationType: "ROUNDS",
        durationValue: 10,
        maxDartsPerTurn: 3,
      },
    });
    expect(store.sessionId).toBe("s1");
    expect(store.configSnapshot?.durationValue).toBe(10);
  });

  it("recordTurn appends a turn and reset() clears the session", () => {
    const store = gameStore(stubPersistFactory());
    store.startSession({
      gameTypeKey: "SCORE_TRAINING",
      sessionId: "s1",
      participantRef: "p1",
      configSnapshot: {
        durationType: "ROUNDS",
        durationValue: 10,
        maxDartsPerTurn: 3,
      },
    });
    store.recordTurn({
      clientKey: "t1",
      sequence: 1,
      totalScore: 45,
      completedAt: null,
    });
    expect(store.turns).toHaveLength(1);
    store.reset();
    expect(store.sessionId).toBeNull();
    expect(store.turns).toEqual([]);
  });

  it('undoLastTurn pops the last turn; no-op when empty', () => {
    const store = gameStore(stubPersistFactory());
    store.startSession({
      gameTypeKey: 'SCORE_TRAINING',
      sessionId: 's1',
      participantRef: 'p1',
      configSnapshot: { durationType: 'ROUNDS', durationValue: 10, maxDartsPerTurn: 3 },
    });
    store.recordTurn({ clientKey: 't1', sequence: 1, totalScore: 45, completedAt: null });
    store.recordTurn({ clientKey: 't2', sequence: 2, totalScore: 60, completedAt: null });
    store.undoLastTurn();
    expect(store.turns).toHaveLength(1);
    expect(store.turns[0].clientKey).toBe('t1');
    store.undoLastTurn();
    expect(store.turns).toEqual([]);
    store.undoLastTurn();
    expect(store.turns).toEqual([]);
  });

  it('regression: reusing one Alpine persist() collapses every .as() key to the last one', () => {
    const { persist, resolveAliases } = createSharedAliasPersist();
    persist([]).as("game.turns");
    persist(null).as("game.idempotencyKey");
    expect(resolveAliases()).toEqual([
      "game.idempotencyKey",
      "game.idempotencyKey",
    ]);
  });

  it("obtains a fresh persist() per field so .as() keys stay isolated", () => {
    let factoryCalls = 0;
    const aliasesAtInit: string[] = [];
    const pendingInits: Array<() => void> = [];

    const factory = () => {
      factoryCalls++;
      let alias: string | undefined;
      return ((initial: unknown) => {
        pendingInits.push(() => {
          aliasesAtInit.push(alias ?? "");
        });
        return {
          as(key: string) {
            alias = key;
            return initial;
          },
        };
      }) as Persist;
    };

    gameStore(factory);
    for (const init of pendingInits) init();

    expect(factoryCalls).toBe(10);
    expect(aliasesAtInit).toEqual([
      "game._v",
      "game.gameTypeKey",
      "game.sessionId",
      "game.participantRef",
      "game.configSnapshot",
      "game.turns",
      "game.timerRemainingMs",
      "game.timerStartedAt",
      "game.timerExpired",
      "game.idempotencyKey",
    ]);
    expect(new Set(aliasesAtInit).size).toBe(aliasesAtInit.length);
  });
});
