import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// F27 Task 1: one-twenty-one-play.data.ts now imports currentFacts from
// play-lifecycle.ts instead of defining its own copy. Confirmed these
// assertions still hold unchanged.
// F27 Task 2: back()/abandonAndExit() now delegate to play-lifecycle.ts's
// shared playBack/playAbandonAndExit (timer.stop() passed as onAbandoned).
// Confirmed these assertions still hold unchanged.
// F27 Task 3: uploadAndCompleteSession() now delegates to play-lifecycle.ts's
// shared playUploadAndCompleteSession. Confirmed these assertions still
// hold unchanged.
// F27 Task 4: playAgain() now delegates to play-lifecycle.ts's shared
// runPlayAgain; resetForReplay is deleted. Confirmed these assertions
// still hold unchanged.
import { oneTwentyOnePlay } from "@lib/game/one-twenty-one-play.data";
import {
  oneTwentyOneEngineFactory,
  oneTwentyOneV2EngineFactory,
} from "@modules/game/one-twenty-one.engine.module";
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

const TWO_SEATS = [
  ...SEATS,
  {
    participantRef: "participant-2",
    displayName: "Guest",
    sideKey: "B",
    participantTypeKey: "GUEST" as const,
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
      timerRemainingMs: null,
      timerStartedAt: null,
      timerExpired: false,
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

    it("computes a VISUAL_BOARD double accuracy from a missed checkout attempt", async () => {
      vi.mocked(sessionsApi.appendBatch).mockResolvedValue(undefined as any);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-09-05T10:00:00Z",
      });
      store.game.inputModeKey = "VISUAL_BOARD";
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      // Starting target 121 (odd -- not directly finishable). Two scoring
      // darts bring the remaining to 40 (directly finishable on D20); the
      // third hits inner single 20 -- same segment as the required double,
      // so it's classified as a missed checkout attempt.
      await play.recordDart.call(play, {
        hitTargetNumber: 13,
        hitZoneKey: "TREBLE",
        locationX: 0,
        locationY: -102,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: 14,
        hitZoneKey: "TREBLE",
        locationX: 0,
        locationY: -102,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: 20,
        hitZoneKey: "INNER_SINGLE",
        locationX: 0,
        locationY: -50,
      });
      store.game.recordFacts(play.engine!.facts());

      await play.uploadAndCompleteSession();

      const [seat] = play.resultsSnapshot!.seats;
      expect(seat.doubleAccuracy).toBe("0.00%");
    });
  });

  describe("checkoutHint", () => {
    it("shows the 3-dart route when the visit has not started", () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      expect(play.checkoutHint.call(play)).toBe("T20 T11 D14");
    });

    it("goes blank once the open visit has too few darts left for the route", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      await play.recordDart.call(play, {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });

      expect(play.checkoutHint.call(play)).toBe("");
    });

    it("still shows a route reachable with the darts left", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.engine!.record({ scoreAttempted: 81 });
      store.game.recordFacts(play.engine!.facts());

      await play.recordDart.call(play, {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });

      expect(play.checkoutHint.call(play)).toBe("D20");
    });

    it("is empty when checkout hints are disabled, even with a valid route", () => {
      const play = createPlay({
        $store: { ...store, checkoutHints: { enabled: false } },
      });
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      expect(play.checkoutHint.call(play)).toBe("");
    });
  });

  describe("recordDart — reveal-then-clear board markers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("keeps the closed visit's markers visible, then clears them after 1500ms", async () => {
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

      const clientKey = store.game.turns[0].clientKey;
      expect(play.hiddenTurnKey).toBeNull();
      expect(play.visitMarkers.call(play)).not.toEqual([]);

      vi.advanceTimersByTime(1500);

      expect(play.hiddenTurnKey).toBe(clientKey);
      expect(play.visitMarkers.call(play)).toEqual([]);
    });

    it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
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

      vi.advanceTimersByTime(1000);
      play.undoVisit();
      vi.advanceTimersByTime(1000);

      expect(play.hiddenTurnKey).toBeNull();
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

  describe("playAgain", () => {
    it("replays a 1v1 match with both seats, engine-seated on the NEW session's refs", async () => {
      store.game.configSnapshot = { seats: TWO_SEATS };
      const play = createPlay();
      play.completionStatus = "succeeded";
      play.finished = true;
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session",
        participants: [
          {
            ref: "new-participant-1",
            displayName: "Levi",
            participantTypeKey: "PLAYER",
          },
          {
            ref: "new-participant-2",
            displayName: "Guest",
            participantTypeKey: "GUEST",
          },
        ],
      } as any);

      await play.playAgain();

      expect(
        vi.mocked(sessionsApi.createSession).mock.calls[0][0].participants,
      ).toEqual([
        { participantTypeKey: "PLAYER", sideKey: "A" },
        { participantTypeKey: "GUEST", displayName: "Guest", sideKey: "B" },
      ]);
      expect(
        play.engine?.state().seats.map((seat) => seat.participantRef),
      ).toEqual(["new-participant-1", "new-participant-2"]);
    });

    it("a solo replay still seats one participant and sends no participants field", async () => {
      const play = createPlay();
      play.completionStatus = "succeeded";
      play.finished = true;
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session",
        participants: [
          {
            ref: "new-participant",
            displayName: "Levi",
            participantTypeKey: "PLAYER",
          },
        ],
      } as any);

      await play.playAgain();

      expect(
        vi.mocked(sessionsApi.createSession).mock.calls[0][0].participants,
      ).toBeUndefined();
      expect(
        play.engine?.state().seats.map((seat) => seat.participantRef),
      ).toEqual(["new-participant"]);
    });
  });
});

describe("oneTwentyOnePlay — per-seat accessors", () => {
  it("currentTargetLabelFor and remainingInAttemptFor read the named seat", () => {
    const ctx = oneTwentyOnePlay() as unknown as {
      $store: {
        game: {
          configSnapshot: { seats: unknown[] };
          stages: unknown[];
          turns: unknown[];
        };
      };
      state: () => {
        activeParticipantRef: string;
        seats: {
          participantRef: string;
          currentTarget: number;
          remainingInAttempt: number;
        }[];
      } | null;
      currentTargetLabelFor: (seatRef: string) => string;
      remainingInAttemptFor: (seatRef: string) => number;
    };
    ctx.$store = {
      game: {
        configSnapshot: {
          seats: [
            {
              participantRef: "p1",
              displayName: "A",
              sideKey: "A",
              participantTypeKey: "PLAYER",
            },
            {
              participantRef: "p2",
              displayName: "B",
              sideKey: "B",
              participantTypeKey: "GUEST",
            },
          ],
        },
        stages: [
          {
            clientKey: "round-1",
            stageTypeKey: "ROUND",
            parentClientKey: null,
            sequence: 1,
          },
        ],
        turns: [],
      },
    };
    expect(ctx.currentTargetLabelFor("p1")).toBe("121");
    expect(ctx.remainingInAttemptFor("p1")).toBe(121);
  });

  it("returns empty/zero defaults with no config snapshot", () => {
    const ctx = oneTwentyOnePlay() as unknown as {
      $store: { game: { configSnapshot: null } };
      state: () => null;
      currentTargetLabel: () => string;
    };
    ctx.$store = { game: { configSnapshot: null } };
    expect(ctx.state()).toBeNull();
  });
});

describe("oneTwentyOnePlay — 121_V2 resume/replay and round/time UI", () => {
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

  describe("resumeEngine — version-aware", () => {
    it("resumes a 121_V2 session", async () => {
      store.game.rulesetVersionKey = "121_V2";
      store.game.configSnapshot = {
        seats: SEATS,
        durationType: "ROUNDS",
        durationValue: 10,
      } as any;
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "session-1", gameTypeKey: "ONE_TWENTY_ONE" } as any,
      ]);
      const play = createPlay();

      await play.init();

      expect(play.hasActiveSession).toBe(true);
      expect(play.engine).not.toBeNull();
    });

    it("refuses to resume a session under a different game's ruleset key", async () => {
      store.game.rulesetVersionKey = "SCORE_TRAINING_V1" as any;
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "session-1", gameTypeKey: "ONE_TWENTY_ONE" } as any,
      ]);
      const play = createPlay();

      await play.init();

      expect(play.hasActiveSession).toBe(false);
    });
  });

  describe("playAgain — version-aware", () => {
    it("replays a 121_V2 session against 121_V2, carrying its own duration config", async () => {
      store.game.rulesetVersionKey = "121_V2";
      store.game.configSnapshot = {
        seats: SEATS,
        durationType: "ROUNDS",
        durationValue: 10,
      } as any;
      const play = createPlay({
        resultsSnapshot: {
          target: 130,
          winningSideKey: null,
          status: "COMPLETE",
          seats: [
            {
              participantRef: "participant-1",
              sideKey: "A",
              target: 130,
              visits: 5,
              average: 40,
              doubleAccuracy: null,
            },
          ],
        },
      });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Levi",
            participantTypeKey: "PLAYER",
          },
        ],
      } as any);

      await play.playAgain();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ rulesetVersionKey: "121_V2" }),
      );
    });

    it("replays a 121_V1 session against 121_V1", async () => {
      const play = createPlay({
        resultsSnapshot: {
          target: 170,
          winningSideKey: null,
          status: "WON",
          seats: [
            {
              participantRef: "participant-1",
              sideKey: "A",
              target: 170,
              visits: 5,
              average: 40,
              doubleAccuracy: null,
            },
          ],
        },
      });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Levi",
            participantTypeKey: "PLAYER",
          },
        ],
      } as any);

      await play.playAgain();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ rulesetVersionKey: "121_V1" }),
      );
    });

    it("does nothing for a ruleset key this shared play page cannot resume", async () => {
      store.game.rulesetVersionKey = "SCORE_TRAINING_V1" as any;
      const play = createPlay();

      await play.playAgain();

      expect(sessionsApi.createSession).not.toHaveBeenCalled();
    });
  });

  describe("durationType / attemptLabel / remainingLabel", () => {
    it("durationType reads TARGET for a 121_V1 session", () => {
      const play = createPlay();
      expect(play.durationType()).toBe("TARGET");
    });

    it("durationType reads the config for a 121_V2 session", () => {
      store.game.configSnapshot = {
        seats: SEATS,
        durationType: "ROUNDS",
        durationValue: 10,
      } as any;
      const play = createPlay();
      expect(play.durationType()).toBe("ROUNDS");
    });

    it("attemptLabel reads attemptsCompleted against duration_value", () => {
      store.game.configSnapshot = {
        seats: SEATS,
        durationType: "ROUNDS",
        durationValue: 10,
      } as any;
      const play = createPlay();
      play.engine = oneTwentyOneV2EngineFactory.create(
        store.game.configSnapshot as any,
      ) as any;
      play.engine!.record({ scoreAttempted: 121, finishedOnDouble: true });
      store.game.recordFacts(play.engine!.facts());
      expect(play.attemptLabel()).toBe("2 of 10");
    });

    it("remainingLabel formats $store.game.timerRemainingMs as mm:ss", () => {
      store.game.timerRemainingMs = 65000;
      const play = createPlay();
      expect(play.remainingLabel()).toBe("01:05");
    });
  });

  describe("computeStats target — generalizes off the owner seat's ladder position", () => {
    it("reports the ladder position reached at a ROUNDS completion, not a hardcoded 170", async () => {
      store.game.configSnapshot = {
        seats: SEATS,
        durationType: "ROUNDS",
        durationValue: 1,
      } as any;
      store.game.rulesetVersionKey = "121_V2";
      vi.mocked(sessionsApi.appendBatch).mockResolvedValue(undefined as any);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-08-14T10:00:00Z",
      });
      const play = createPlay();
      play.engine = oneTwentyOneV2EngineFactory.create(
        store.game.configSnapshot as any,
      ) as any;
      play.engine!.record({ scoreAttempted: 121, finishedOnDouble: true });
      store.game.recordFacts(play.engine!.facts());

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.target).toBe(122);
      expect(play.resultsSnapshot?.status).toBe("COMPLETE");
      expect(play.resultsTitle()).toBe("Session complete");
    });

    it("still reports 170 and status WON for a genuine cap checkout", async () => {
      vi.mocked(sessionsApi.appendBatch).mockResolvedValue(undefined as any);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-08-14T10:00:00Z",
      });
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      for (let target = 121; target < 170; target++) {
        play.engine!.record({ scoreAttempted: target, finishedOnDouble: true });
      }
      play.engine!.record({ scoreAttempted: 170, finishedOnDouble: true });
      store.game.recordFacts(play.engine!.facts());

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.target).toBe(170);
      expect(play.resultsSnapshot?.status).toBe("WON");
      expect(play.resultsTitle()).toBe("170 checked out!");
    });

    it("computes both seats' own visits/average/target independently in a 1v1 match", async () => {
      vi.mocked(sessionsApi.appendBatch).mockResolvedValue(undefined as any);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-08-14T10:00:00Z",
      });
      store.game.configSnapshot = { seats: TWO_SEATS } as any;
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(
        store.game.configSnapshot as any,
      ) as any;
      play.engine!.record({ scoreAttempted: 100, finishedOnDouble: false });
      play.engine!.record({ scoreAttempted: 80, finishedOnDouble: false });
      store.game.recordFacts(play.engine!.facts());

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.seats).toEqual([
        {
          participantRef: "participant-1",
          sideKey: "A",
          target: 121,
          visits: 1,
          average: 100,
          doubleAccuracy: null,
        },
        {
          participantRef: "participant-2",
          sideKey: "B",
          target: 121,
          visits: 1,
          average: 80,
          doubleAccuracy: null,
        },
      ]);
    });
  });
});

describe("oneTwentyOnePlay — DartBot opponent", () => {
  const BOT_REF = "bot-1";
  const HUMAN_REF = "human-1";

  function seatsWithBot() {
    return [
      {
        participantRef: HUMAN_REF,
        displayName: "Levi",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: BOT_REF,
        displayName: "DartBot",
        sideKey: "B",
        participantTypeKey: "DARTBOT" as const,
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" as const },
      },
    ];
  }

  function botConfig() {
    return { seats: seatsWithBot() };
  }

  let store: OneTwentyOnePlayContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = baseStore();
    store.game.configSnapshot = botConfig();
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "session-1", gameTypeKey: "ONE_TWENTY_ONE" } as any,
    ]);
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

  it("under VISUAL_BOARD, the bot throws its own visit once it becomes active", async () => {
    store.game.inputModeKey = "VISUAL_BOARD";
    const play = createPlay();
    await play.init();

    await play.recordVisit(26, false);

    const botTurns = store.game.turns.filter(
      (turn) => turn.participantRef === BOT_REF,
    );
    expect(botTurns.length).toBeGreaterThan(0);
    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);
  });

  it("under QUICK_SCORE, the bot's visit uploads as one turn with darts: []", async () => {
    const play = createPlay();
    await play.init();

    await play.recordVisit(26, false);

    const botTurn = store.game.turns.find(
      (turn) => turn.participantRef === BOT_REF,
    );
    expect(botTurn).toBeDefined();
    expect(botTurn!.darts).toEqual([]);
  });

  it("undoVisit crosses the seat boundary back to the human", async () => {
    const play = createPlay();
    await play.init();
    await play.recordVisit(26, false);
    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);

    play.undoVisit();

    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);
  });
});
