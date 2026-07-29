import { describe, it, expect } from "vitest";
import type { Persist } from "@alpinejs/persist";
import { gameStore } from "@stores/game.store";
import type { EngineFacts } from "@modules/types";

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

/**
 * Mirrors Alpine's rehydration: a field whose alias is present in localStorage
 * comes back with the stored value, everything else falls back to its default.
 */
function rehydratingPersistFactory(
  stored: Record<string, unknown>,
): () => Persist {
  return () =>
    ((initial: unknown) => ({
      as: (alias: string) => (alias in stored ? stored[alias] : initial),
    })) as Persist;
}

/** A turn as v1 persisted it: no `stageClientKey`, so uploads would throw. */
const V1_TURN = {
  clientKey: "t1",
  sequence: 1,
  completedAt: "2026-07-20T10:00:00.000Z",
  totalScore: 60,
  darts: [],
};

const SESSION_INPUT = {
  gameTypeKey: "SCORE_TRAINING",
  rulesetVersionKey: "SCORE_TRAINING_V1",
  sessionId: "s1",
  participantRef: "p1",
  templateRef: "tpl-1",
  configSnapshot: {
    durationType: "ROUNDS",
    durationValue: 10,
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
  },
} as const;

const FACTS: EngineFacts = {
  stages: [
    {
      clientKey: "block-1",
      stageTypeKey: "EXERCISE_BLOCK",
      parentClientKey: null,
      sequence: 1,
    },
  ],
  turns: [
    {
      clientKey: "t1",
      stageClientKey: "block-1",
      sequence: 1,
      completedAt: "2026-07-25T10:00:00.000Z",
      totalScore: 60,
      darts: [],
    },
  ],
};

describe("gameStore", () => {
  it("starts with an empty fact log and no session", () => {
    const store = gameStore(stubPersistFactory());
    expect(store.sessionId).toBeNull();
    expect(store.rulesetVersionKey).toBeNull();
    expect(store.templateRef).toBeNull();
    expect(store.stages).toEqual([]);
    expect(store.turns).toEqual([]);
  });

  it("stores the ruleset version alongside the config snapshot", () => {
    const store = gameStore(stubPersistFactory());
    store.startSession({ ...SESSION_INPUT });

    expect(store.gameTypeKey).toBe("SCORE_TRAINING");
    expect(store.rulesetVersionKey).toBe("SCORE_TRAINING_V1");
    expect(store.sessionId).toBe("s1");
    expect(store.participantRef).toBe("p1");
    expect(store.templateRef).toBe("tpl-1");
    expect(store.configSnapshot).toEqual(SESSION_INPUT.configSnapshot);
    expect(store.turns).toEqual([]);
    expect(store.stages).toEqual([]);
  });

  it("startSession clears any fact log and upload state left by a prior session", () => {
    const store = gameStore(stubPersistFactory());
    store.recordFacts(FACTS);
    store.idempotencyKey = "old-key";
    store.timerRemainingMs = 1000;
    store.timerStartedAt = "2026-07-25T09:00:00.000Z";
    store.timerExpired = true;

    store.startSession({ ...SESSION_INPUT });

    expect(store.stages).toEqual([]);
    expect(store.turns).toEqual([]);
    expect(store.idempotencyKey).toBeNull();
    expect(store.timerRemainingMs).toBeNull();
    expect(store.timerStartedAt).toBeNull();
    expect(store.timerExpired).toBe(false);
  });

  it("recordFacts persists the engine's stages and turns", () => {
    const store = gameStore(stubPersistFactory());
    store.recordFacts(FACTS);

    expect(store.stages).toEqual(FACTS.stages);
    expect(store.turns).toEqual(FACTS.turns);
  });

  it("replaces the fact log wholesale so engine and store cannot diverge", () => {
    const store = gameStore(stubPersistFactory());
    store.recordFacts(FACTS);
    store.recordFacts({ stages: [], turns: [] });

    expect(store.turns).toEqual([]);
    expect(store.stages).toEqual([]);
  });

  it("detaches the recorded log from the engine's arrays", () => {
    const store = gameStore(stubPersistFactory());
    const facts: EngineFacts = {
      stages: [...FACTS.stages],
      turns: [...FACTS.turns],
    };
    store.recordFacts(facts);

    facts.turns.push(FACTS.turns[0]);

    expect(store.turns).toHaveLength(1);
  });

  it("clears every field on reset", () => {
    const store = gameStore(stubPersistFactory());
    store.startSession({ ...SESSION_INPUT });
    store.recordFacts(FACTS);
    store.idempotencyKey = "key";
    store.timerRemainingMs = 5000;
    store.timerStartedAt = "2026-07-25T09:00:00.000Z";
    store.timerExpired = true;

    store.reset();

    expect(store.gameTypeKey).toBeNull();
    expect(store.sessionId).toBeNull();
    expect(store.rulesetVersionKey).toBeNull();
    expect(store.participantRef).toBeNull();
    expect(store.templateRef).toBeNull();
    expect(store.configSnapshot).toBeNull();
    expect(store.stages).toEqual([]);
    expect(store.turns).toEqual([]);
    expect(store.timerRemainingMs).toBeNull();
    expect(store.timerStartedAt).toBeNull();
    expect(store.timerExpired).toBe(false);
    expect(store.idempotencyKey).toBeNull();
  });

  it("defaults loading to false and clears it on reset", () => {
    const store = gameStore(stubPersistFactory());
    expect(store.loading).toBe(false);
    store.loading = true;
    store.reset();
    expect(store.loading).toBe(false);
  });

  describe("D91 store version", () => {
    /**
     * Real Alpine resolves every `$persist` field to its hydrated value
     * before calling a registered store's `init()` (`initInterceptors` runs
     * first in `alpinejs/src/store.js`). The version check must live in
     * `init()`, not run eagerly in the factory body: at factory-construction
     * time in real Alpine, `_v` is still the unresolved interceptor Alpine's
     * persist plugin returns, so an eager `!==` comparison there is never
     * equal and would discard on every single page load regardless of the
     * real persisted version. This test pins that the factory itself does
     * not touch state — only `init()`, called after the fields hold their
     * real values, may discard.
     */
    it("does not discard eagerly — the factory leaves incompatible state untouched until init() runs", () => {
      const store = gameStore(
        rehydratingPersistFactory({
          "game._v": 1,
          "game.sessionId": "stale-session",
        }),
      );

      expect(store.sessionId).toBe("stale-session");
      expect(store._v).toBe(1);
    });

    it("discards persisted state written by an incompatible store version once init() runs", () => {
      const store = gameStore(
        rehydratingPersistFactory({
          "game._v": 1,
          "game.gameTypeKey": "SCORE_TRAINING",
          "game.rulesetVersionKey": "SCORE_TRAINING_V1",
          "game.sessionId": "stale-session",
          "game.participantRef": "stale-participant",
          "game.configSnapshot": SESSION_INPUT.configSnapshot,
          "game.templateRef": "tpl-1",
          "game.stages": [],
          "game.turns": [V1_TURN],
          "game.timerRemainingMs": 5000,
          "game.timerStartedAt": "2026-07-20T10:00:00.000Z",
          "game.timerExpired": true,
          "game.idempotencyKey": "stale-key",
        }),
      );

      store.init();

      expect(store.turns).toEqual([]);
      expect(store.stages).toEqual([]);
      expect(store.sessionId).toBeNull();
      expect(store.gameTypeKey).toBeNull();
      expect(store.rulesetVersionKey).toBeNull();
      expect(store.participantRef).toBeNull();
      expect(store.configSnapshot).toBeNull();
      expect(store.templateRef).toBeNull();
      expect(store.timerRemainingMs).toBeNull();
      expect(store.timerStartedAt).toBeNull();
      expect(store.timerExpired).toBe(false);
      expect(store.idempotencyKey).toBeNull();
    });

    it("stamps the current version so the discard happens exactly once", () => {
      const store = gameStore(
        rehydratingPersistFactory({ "game._v": 1, "game.sessionId": "stale" }),
      );

      store.init();

      expect(store._v).toBe(2);
    });

    it("rehydrates state written by the current store version without discarding", () => {
      const store = gameStore(
        rehydratingPersistFactory({
          "game._v": 2,
          "game.sessionId": "live-session",
          "game.stages": FACTS.stages,
          "game.turns": FACTS.turns,
        }),
      );

      store.init();

      expect(store.sessionId).toBe("live-session");
      expect(store.turns).toEqual(FACTS.turns);
      expect(store.stages).toEqual(FACTS.stages);
    });
  });

  it("regression: reusing one Alpine persist() collapses every .as() key to the last one", () => {
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

    expect(factoryCalls).toBe(13);
    expect(aliasesAtInit).toEqual([
      "game._v",
      "game.gameTypeKey",
      "game.rulesetVersionKey",
      "game.sessionId",
      "game.participantRef",
      "game.configSnapshot",
      "game.templateRef",
      "game.stages",
      "game.turns",
      "game.timerRemainingMs",
      "game.timerStartedAt",
      "game.timerExpired",
      "game.idempotencyKey",
    ]);
    expect(new Set(aliasesAtInit).size).toBe(aliasesAtInit.length);
  });
});
