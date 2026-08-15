import { describe, it, expect, vi, beforeEach } from "vitest";
import { oneTwentyOnePlay } from "@lib/game/one-twenty-one-play.data";
import { oneTwentyOneEngineFactory } from "@modules/game/one-twenty-one.engine.module";
import type { OneTwentyOnePlayContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");

function baseStore(): OneTwentyOnePlayContext["$store"] {
  return {
    game: {
      rulesetVersionKey: "121_V1",
      sessionId: "session-1",
      participantRef: "participant-1",
      templateRef: "tmpl-121-standard",
      configSnapshot: {},
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
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      play.scoreInput.setValue("60");

      await play.submitVisit();

      expect(store.game.turns).toHaveLength(1);
      expect(store.game.turns[0].totalScore).toBe(60);
      expect(play.showDoubleConfirm).toBe(false);
    });

    it("opens the double-confirm dialog for a visit that would reach exactly zero via a real checkout path", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      play.engine!.record({ scoreAttempted: 81 });
      store.game.recordFacts(play.engine!.facts());
      play.scoreInput.setValue("40");

      await play.submitVisit();

      expect(play.showDoubleConfirm).toBe(true);
      expect(store.game.turns).toHaveLength(1);
    });

    it("confirmDouble records a checkout that only climbs the ladder immediately", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      play.engine!.record({ scoreAttempted: 81 });
      play.pendingCheckoutScore = 40;
      play.showDoubleConfirm = true;

      await play.confirmDouble();

      expect(store.game.turns.at(-1)?.totalScore).toBe(40);
      expect(play.showDoubleConfirm).toBe(false);
      expect(play.showSessionFinishConfirm).toBe(false);
    });

    it("confirmDouble defers to the session-finish confirm for a checkout at the cap target", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
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

    it("denyDouble records the visit as a bust", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      play.engine!.record({ scoreAttempted: 81 });
      play.pendingCheckoutScore = 40;
      play.showDoubleConfirm = true;

      await play.denyDouble();

      expect(store.game.turns.at(-1)?.totalScore).toBe(0);
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
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
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
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
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
});
