import { describe, it, expect, vi, beforeEach } from "vitest";
import { oneTwentyOnePlay } from "@lib/game/one-twenty-one-play.data";
import { oneTwentyOneEngineFactory } from "@modules/game/one-twenty-one.engine.module";
import type { OneTwentyOnePlayContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config = { seats: SEATS };

function baseStore(): OneTwentyOnePlayContext["$store"] {
  return {
    game: {
      get seats() {
        return this.configSnapshot?.seats ?? [];
      },
      rulesetVersionKey: "121_V1",
      sessionId: "session-1",
      templateRef: "tmpl-121-standard",
      configSnapshot: config,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      stages: [],
      turns: [],
      idempotencyKey: null,
      loading: false,
      recordFacts: vi.fn(function (
        this: OneTwentyOnePlayContext["$store"]["game"],
        facts,
      ) {
        this.stages = facts.stages;
        this.turns = facts.turns;
      }),
      setSessionModes: vi.fn(),
      reset: vi.fn(),
    },
    settings: { captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" },
  };
}

describe("oneTwentyOnePlay", () => {
  let store: OneTwentyOnePlayContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = baseStore();
  });

  function createPlay(
    overrides: Partial<OneTwentyOnePlayContext> = {},
  ): OneTwentyOnePlayContext {
    return {
      ...oneTwentyOnePlay(),
      $store: store,
      ...overrides,
    } as OneTwentyOnePlayContext;
  }

  describe("submitVisit / double confirm", () => {
    it("records an ordinary scoring visit immediately", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.scoreInput.setValue("60");

      await play.submitVisit();

      expect(store.game.turns).toHaveLength(1);
      expect(store.game.turns[0].totalScore).toBe(60);
      expect(play.showDoubleConfirm).toBe(false);
    });

    it("opens the double-confirm dialog for a visit that would reach exactly zero via a real checkout path", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.engine!.record({ scoreAttempted: 81 });
      store.game.recordFacts(play.engine!.facts());
      play.scoreInput.setValue("40");

      await play.submitVisit();

      expect(play.showDoubleConfirm).toBe(true);
      expect(store.game.turns).toHaveLength(1);
    });

    it("offers the counts the finished score's route allows, preselecting the shortest", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.engine!.record({ scoreAttempted: 80 });
      store.game.recordFacts(play.engine!.facts());
      play.scoreInput.setValue("41");

      await play.submitVisit();

      expect(play.checkoutDartOptions.call(play)).toEqual({
        toFinish: [2, 3],
        atDouble: [1, 2],
      });
      expect(play.dartsToFinish).toBe(2);
      expect(play.dartsAtDouble).toBe(1);
    });

    it("surfaces the engine's rejection when the counts cannot be true", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.engine!.record({ scoreAttempted: 80 });
      store.game.recordFacts(play.engine!.facts());
      play.scoreInput.setValue("41");
      await play.submitVisit();
      play.dartsToFinish = 1;

      await play.confirmDouble();

      expect(store.game.turns).toHaveLength(1);
      expect(play.error).toMatch(/at least 2 darts/);
    });

    it("confirmDouble records a checkout that only climbs the ladder immediately", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.engine!.record({ scoreAttempted: 81 });
      play.pendingCheckoutScore = 40;
      play.showDoubleConfirm = true;

      await play.confirmDouble();

      expect(store.game.turns.at(-1)?.totalScore).toBe(40);
      expect(play.showDoubleConfirm).toBe(false);
      expect(play.showSessionFinishConfirm).toBe(false);
    });

    it("resets the active score to the new target's full value after a checkout, not the stale start target (#128)", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.engine!.record({ scoreAttempted: 81 });
      play.pendingCheckoutScore = 40;
      play.showDoubleConfirm = true;

      await play.confirmDouble();

      expect(play.currentTargetLabel.call(play)).toBe("122");
      expect(play.remainingInAttempt.call(play)).toBe(122);
      expect(play.visitsThisAttempt.call(play)).toBe(0);
    });

    it("confirmDouble defers to the session-finish confirm for a checkout at the cap target", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      for (let target = 121; target < 170; target += 1) {
        play.engine!.record({ scoreAttempted: target, finishedOnDouble: true });
      }
      store.game.recordFacts(play.engine!.facts());
      play.pendingCheckoutScore = 170;
      play.showDoubleConfirm = true;

      await play.confirmDouble();

      expect(play.showSessionFinishConfirm).toBe(true);
      expect(store.game.turns.at(-1)?.stageClientKey).not.toBeUndefined();
    });

    it("cancelCheckout restores the score to the keypad without recording", () => {
      const play = createPlay({
        pendingCheckoutScore: 40,
        showDoubleConfirm: true,
      });

      play.cancelCheckout();

      expect(play.scoreInput.value).toBe("40");
      expect(play.showDoubleConfirm).toBe(false);
      expect(store.game.turns).toHaveLength(0);
    });
  });

  describe("undoVisit", () => {
    it("undoes the last recorded visit and mirrors the fact log", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.scoreInput.setValue("60");
      await play.submitVisit();
      expect(store.game.turns).toHaveLength(1);

      play.undoVisit();

      expect(store.game.turns).toHaveLength(0);
    });
  });

  describe("uploadAndCompleteSession", () => {
    it("uploads the batch, completes the session, and snapshots the results", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      for (let target = 121; target < 170; target += 1) {
        play.engine!.record({ scoreAttempted: target, finishedOnDouble: true });
      }
      play.engine!.record({ scoreAttempted: 170, finishedOnDouble: true });
      store.game.recordFacts(play.engine!.facts());
      vi.mocked(sessionsApi.appendBatch).mockResolvedValue(undefined as any);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-08-14T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.completionStatus).toBe("succeeded");
      expect(play.resultsSnapshot?.target).toBe(170);
    });
  });

  describe("recordDart (board input)", () => {
    it("opens a visit and records one dart without closing it", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      await play.recordDart.call(play, {
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        locationX: 0,
        locationY: -102,
      });

      expect(play.$store.game.turns).toHaveLength(1);
      expect(play.$store.game.turns[0].completedAt).toBeNull();
      expect(play.remainingInAttempt.call(play)).toBe(61);
    });

    it("closes the visit on the third dart", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });

      expect(play.$store.game.turns[0].completedAt).not.toBeNull();
      expect(play.$store.game.turns[0].darts).toHaveLength(3);
    });

    it("undo removes one dart at a time, not the whole visit", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });

      play.undoVisit.call(play);

      expect(play.$store.game.turns).toHaveLength(1);
      expect(play.$store.game.turns[0].darts).toHaveLength(1);
    });
  });

  describe("recordDart — session-ending checkout defers to the confirm dialog", () => {
    it("opens showSessionFinishConfirm instead of recording immediately", async () => {
      const play = createPlay();
      const engine = oneTwentyOneEngineFactory.create(config) as any;
      for (let target = 121; target < 170; target += 1) {
        engine.record({ scoreAttempted: target, finishedOnDouble: true });
      }
      // Only a genuine DOUBLE dart checks a board visit out (matches
      // `five-oh-one.engine.module.ts`'s own rule), and the max reachable
      // via 3 darts ending on a double is 160 — so this keypad visit brings
      // the remaining total from 170 down to 40 first, leaving exactly one
      // D20 (40) to finish it.
      engine.record({ scoreAttempted: 130 });
      play.engine = engine;
      play.$store.game.recordFacts(engine.facts());

      await play.recordDart.call(play, {
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        locationX: 0,
        locationY: -166,
      });

      expect(play.showSessionFinishConfirm).toBe(true);
      expect(play.pendingDartObservation).toEqual({
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        locationX: 0,
        locationY: -166,
      });
      expect(play.finished).toBe(false);
    });

    it("confirmSessionFinish records the deferred dart and finishes", async () => {
      vi.mocked(sessionsApi.appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 1 },
      } as any);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "now",
      } as any);

      const play = createPlay();
      const engine = oneTwentyOneEngineFactory.create(config) as any;
      for (let target = 121; target < 170; target += 1) {
        engine.record({ scoreAttempted: target, finishedOnDouble: true });
      }
      // Only a genuine DOUBLE dart checks a board visit out (matches
      // `five-oh-one.engine.module.ts`'s own rule), and the max reachable
      // via 3 darts ending on a double is 160 — so this keypad visit brings
      // the remaining total from 170 down to 40 first, leaving exactly one
      // D20 (40) to finish it.
      engine.record({ scoreAttempted: 130 });
      play.engine = engine;
      play.$store.game.recordFacts(engine.facts());
      await play.recordDart.call(play, {
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        locationX: 0,
        locationY: -166,
      });

      await play.confirmSessionFinish.call(play);

      expect(play.showSessionFinishConfirm).toBe(false);
      expect(play.pendingDartObservation).toBeNull();
      expect(play.finished).toBe(true);
    });

    it("cancelSessionFinish records nothing", async () => {
      const play = createPlay();
      const engine = oneTwentyOneEngineFactory.create(config) as any;
      for (let target = 121; target < 170; target += 1) {
        engine.record({ scoreAttempted: target, finishedOnDouble: true });
      }
      // Only a genuine DOUBLE dart checks a board visit out (matches
      // `five-oh-one.engine.module.ts`'s own rule), and the max reachable
      // via 3 darts ending on a double is 160 — so this keypad visit brings
      // the remaining total from 170 down to 40 first, leaving exactly one
      // D20 (40) to finish it.
      engine.record({ scoreAttempted: 130 });
      play.engine = engine;
      play.$store.game.recordFacts(engine.facts());
      const turnCountBefore = play.$store.game.turns.length;
      await play.recordDart.call(play, {
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        locationX: 0,
        locationY: -166,
      });

      play.cancelSessionFinish.call(play);

      expect(play.showSessionFinishConfirm).toBe(false);
      expect(play.pendingDartObservation).toBeNull();
      expect(play.$store.game.turns).toHaveLength(turnCountBefore);
      expect(play.finished).toBe(false);
    });
  });
});
