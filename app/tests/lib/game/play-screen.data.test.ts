import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import {
  botDartObservationAt,
  botThrowObservation,
  x01BotIntent,
} from "@lib/game/play-bot-seat";

vi.mock("@lib/game/play-lifecycle", () => ({
  playInit: vi.fn(async () => {}),
  playCommitDart: vi.fn(async () => {}),
  playUndoVisit: vi.fn(),
  undoToActiveSeat: vi.fn(),
  undoPastBot: vi.fn(() => false),
  playVisitMarkers: vi.fn(() => []),
  playBack: vi.fn(async () => {}),
  playAbandonAndExit: vi.fn(async () => {}),
  playRetryReconciliation: vi.fn(async () => {}),
  playRunBotVisualBoardVisit: vi.fn(async () => {}),
  playBotQuickScoreVisit: vi.fn(async () => null),
  playToggleTimerPause: vi.fn(),
}));

import {
  playAbandonAndExit,
  playBack,
  playBotQuickScoreVisit,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playRunBotVisualBoardVisit,
  playToggleTimerPause,
  playUndoVisit,
  playVisitMarkers,
  undoPastBot,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import {
  activeSeatStateOf,
  boardPlayActions,
  boundBoardInput,
  checkoutDartCounts,
  confirmCheckout,
  openCheckoutConfirm,
  playRunGatedBotVisit,
  playTimedInit,
  playX01BotVisit,
  recordCheckoutVisit,
  restoreCheckoutScore,
  botVisualBoardData,
  forActiveSeat,
  playScreenActions,
  playScreenState,
  resetTimerForPlayAgain,
  resetTimerStoreFields,
  seatStateFor,
  timedPlayData,
  timedScoreScreenData,
} from "@lib/game/play-screen.data";
import type { DartbotSeat, PlayStoreContext, SeatFact } from "@lib/types";
import type { GameEngine } from "@modules/interfaces";
import type { DartObservation, MultiSeatState, TurnFact } from "@modules/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";

type Engine = GameEngine<DartObservation, MultiSeatState>;

const PLAYER: SeatFact = {
  participantRef: "p1",
  displayName: "Levi",
  sideKey: "A",
  participantTypeKey: "PLAYER",
};
const BOT = {
  participantRef: "b1",
  displayName: "Dartbot",
  sideKey: "B",
  participantTypeKey: "DARTBOT",
  dartbot: { level: 5, seed: 1 },
} as unknown as DartbotSeat;

const MISS: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: null,
  locationY: null,
};

function fakeBoard(): SVGSVGElement {
  const matrix = { inverse: () => matrix, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const point = {
    x: 0,
    y: 0,
    matrixTransform: () => ({ x: point.x, y: point.y }),
  };
  return {
    createSVGPoint: () => point,
    getScreenCTM: () => matrix,
  } as unknown as SVGSVGElement;
}

function fakeTimer(): SegmentTimer {
  return { stop: vi.fn() } as unknown as SegmentTimer;
}

function store(seats: readonly SeatFact[], turns: TurnFact[] = []) {
  return {
    game: {
      seats,
      turns,
      stages: [],
      timerRemainingMs: 5000 as number | null,
      timerStartedAt: "2026-10-31T00:00:00Z" as string | null,
      timerExpired: true,
      timerPaused: true,
    },
    boardInput: { handedness: "RIGHT" as const },
  } as unknown as PlayStoreContext<unknown> & {
    boardInput: { handedness: "RIGHT" };
  };
}

function lifecycle(seats: readonly SeatFact[] = [PLAYER]) {
  return {
    ...playScreenState<Engine, unknown>(),
    $store: store(seats),
    $refs: { board: fakeBoard() },
    init: vi.fn(async () => {}),
    uploadAndCompleteSession: vi.fn(async () => {}),
  };
}

const resume = vi.fn(() => null);

function boardScreen(
  seats: readonly SeatFact[] = [PLAYER],
  afterInit?: () => void | Promise<void>,
) {
  const { init: _init, ...base } = lifecycle(seats);
  return Object.assign(
    boardPlayActions<unknown, Engine>({
      gameTypeKey: "TEST",
      resume,
      afterInit,
    }),
    base,
    { engine: {} as Engine | null },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("playScreenState", () => {
  it("starts every lifecycle field at the factories' own initial value", () => {
    expect(playScreenState()).toEqual({
      loading: false,
      error: "",
      finished: false,
      hasActiveSession: false,
      loadingReconciliation: false,
      reconciliationFailed: false,
      completionStatus: "pending",
      completionError: "",
      playAgainError: "",
      playAgainLoading: false,
      resultsSnapshot: null,
      hiddenTurnKey: null,
      hiddenTimer: null,
      engine: null,
    });
  });

  it("returns a fresh object per call", () => {
    const first = playScreenState();
    const second = playScreenState();
    expect(first).not.toBe(second);
    first.error = "boom";
    expect(second.error).toBe("");
  });
});

describe("playScreenActions", () => {
  it("delegates back, retryReconciliation and visitMarkers to the lifecycle", async () => {
    const ctx = Object.assign(playScreenActions(), lifecycle());
    await ctx.back();
    await ctx.retryReconciliation();
    ctx.visitMarkers();
    expect(playBack).toHaveBeenCalledWith(ctx);
    expect(playRetryReconciliation).toHaveBeenCalledWith(ctx);
    expect(playVisitMarkers).toHaveBeenCalledWith(ctx);
  });

  it("abandonAndExit abandons with no callback", async () => {
    const ctx = Object.assign(playScreenActions(), lifecycle());
    await expect(ctx.abandonAndExit()).resolves.toBeUndefined();
    expect(vi.mocked(playAbandonAndExit).mock.calls[0]).toEqual([ctx]);
    expect(vi.mocked(playAbandonAndExit).mock.calls[0][0]).toBe(ctx);
  });
});

describe("boardPlayActions", () => {
  it("init runs playInit with the spec, then the bot visit when present", async () => {
    const ctx = Object.assign(boardScreen(), {
      maybeRunBotVisit: vi.fn(async () => {}),
    });
    await ctx.init();
    expect(playInit).toHaveBeenCalledWith(ctx, "TEST", resume);
    expect(ctx.maybeRunBotVisit).toHaveBeenCalledOnce();
  });

  it("init does not throw without a bot visit", async () => {
    await expect(boardScreen().init()).resolves.toBeUndefined();
  });

  it("a board tap after init reaches recordDart and commits the dart", async () => {
    const ctx = boardScreen();
    await ctx.init();
    ctx.recordUnseen.call(ctx as never);
    await vi.waitFor(() =>
      expect(playCommitDart).toHaveBeenCalledWith(ctx, MISS),
    );
  });

  it("a board tap after init with an afterInit reaches recordDart", async () => {
    const afterInit = vi.fn();
    const ctx = boardScreen([PLAYER], afterInit);
    await ctx.init();
    ctx.recordUnseen.call(ctx as never);
    await vi.waitFor(() =>
      expect(playCommitDart).toHaveBeenCalledWith(ctx, MISS),
    );
    expect(afterInit).toHaveBeenCalledOnce();
  });

  it("afterInit runs after playInit and before the bot visit", async () => {
    const order: string[] = [];
    vi.mocked(playInit).mockImplementationOnce(async () => {
      order.push("playInit");
    });
    const ctx = Object.assign(
      boardScreen([PLAYER], async () => {
        await Promise.resolve();
        order.push("afterInit");
      }),
      {
        maybeRunBotVisit: vi.fn(async () => {
          order.push("bot");
        }),
      },
    );
    await ctx.init();
    expect(order).toEqual(["playInit", "afterInit", "bot"]);
  });

  it("afterInit receives the page context", async () => {
    const afterInit = vi.fn();
    const ctx = boardScreen([PLAYER], afterInit);
    await ctx.init();
    expect(afterInit.mock.calls[0][0]).toBe(ctx);
  });

  it("recordDart ignores a dart without an engine or once finished", async () => {
    const idle = Object.assign(boardScreen(), { engine: null });
    await idle.recordDart(MISS);
    const done = Object.assign(boardScreen(), { finished: true });
    await done.recordDart(MISS);
    expect(playCommitDart).not.toHaveBeenCalled();
  });

  it("commitDart commits, then runs the bot visit", async () => {
    const ctx = Object.assign(boardScreen(), {
      maybeRunBotVisit: vi.fn(async () => {}),
    });
    await ctx.commitDart(MISS);
    expect(playCommitDart).toHaveBeenCalledWith(ctx, MISS);
    expect(ctx.maybeRunBotVisit).toHaveBeenCalledOnce();
  });

  it("commitDart without a bot visit commits and stops", async () => {
    const ctx = boardScreen();
    await ctx.commitDart(MISS);
    expect(playCommitDart).toHaveBeenCalledWith(ctx, MISS);
    expect(playCommitDart).toHaveBeenCalledOnce();
  });

  it("undoVisit without a bot visit calls plain undo", async () => {
    const ctx = boardScreen([PLAYER, BOT]);
    await ctx.undoVisit();
    expect(playUndoVisit).toHaveBeenCalledWith(ctx);
    expect(vi.mocked(playUndoVisit).mock.calls[0][0]).toBe(ctx);
    expect(undoToActiveSeat).not.toHaveBeenCalled();
  });

  it("undoVisit with a bot seat undoes to the PLAYER seat, then reruns the bot", async () => {
    const ctx = Object.assign(boardScreen([BOT, PLAYER]), {
      maybeRunBotVisit: vi.fn(async () => {}),
    });
    vi.mocked(undoPastBot).mockReturnValueOnce(true);
    await ctx.undoVisit();
    expect(vi.mocked(undoPastBot).mock.calls[0][0]).toBe(ctx);
    expect(playUndoVisit).not.toHaveBeenCalled();
    expect(ctx.maybeRunBotVisit).toHaveBeenCalledOnce();
  });

  it("undoVisit with a bot visit but no bot seat pops one visit", async () => {
    const ctx = Object.assign(boardScreen([PLAYER]), {
      maybeRunBotVisit: vi.fn(async () => {}),
    });
    vi.mocked(undoPastBot).mockReturnValueOnce(false);
    await ctx.undoVisit();
    expect(vi.mocked(undoPastBot).mock.calls[0][0]).toBe(ctx);
    expect(playUndoVisit).toHaveBeenCalledWith(ctx);
    expect(ctx.maybeRunBotVisit).toHaveBeenCalledOnce();
  });

  it("visitMarkers overrides the board's own with the lifecycle one", () => {
    const ctx = boardScreen();
    ctx.visitMarkers();
    expect(playVisitMarkers).toHaveBeenCalledWith(ctx);
  });
});

describe("botVisualBoardData", () => {
  function botScreen(seats: readonly SeatFact[]) {
    const throwBotDart = vi.fn(() => ({
      observation: MISS,
      pacing: { preThrowMs: 0, postThrowMs: 0 },
    }));
    const ctx = Object.assign(
      botVisualBoardData(throwBotDart),
      lifecycle(seats),
    );
    return { ctx, throwBotDart };
  }

  it("starts idle with no flight", () => {
    const { ctx } = botScreen([PLAYER]);
    expect(ctx.botThrowing).toBe(false);
    expect(ctx.botFlight).toBeNull();
  });

  it("runs the visual-board visit for the bot seat with its thrower", async () => {
    const { ctx, throwBotDart } = botScreen([PLAYER, BOT]);
    await ctx.maybeRunBotVisit();
    const [context, botRef, thrower] = vi.mocked(playRunBotVisualBoardVisit)
      .mock.calls[0];
    expect(context).toBe(ctx);
    expect(botRef).toBe("b1");
    thrower();
    expect(throwBotDart).toHaveBeenCalledWith(ctx, BOT);
  });

  it("does nothing without a bot seat", async () => {
    const { ctx } = botScreen([PLAYER]);
    await ctx.maybeRunBotVisit();
    expect(playRunBotVisualBoardVisit).not.toHaveBeenCalled();
  });
});

describe("timedPlayData", () => {
  it("starts with no timer", () => {
    expect(timedPlayData().timer).toBeNull();
  });

  it("togglePause delegates to the lifecycle", () => {
    const ctx = Object.assign(timedPlayData(), lifecycle());
    ctx.togglePause();
    expect(playToggleTimerPause).toHaveBeenCalledWith(ctx);
  });

  it("abandonAndExit stops a present timer once abandoned", async () => {
    const timer = fakeTimer();
    const ctx = Object.assign(
      playScreenActions(),
      timedPlayData(),
      lifecycle(),
      {
        timer,
      },
    );
    await ctx.abandonAndExit();
    const [context, onAbandoned] = vi.mocked(playAbandonAndExit).mock.calls[0];
    expect(context).toBe(ctx);
    await onAbandoned?.();
    expect(timer.stop).toHaveBeenCalledOnce();
  });

  it("abandonAndExit does not throw before a timer starts", async () => {
    const ctx = Object.assign(timedPlayData(), lifecycle());
    await ctx.abandonAndExit();
    const [, onAbandoned] = vi.mocked(playAbandonAndExit).mock.calls[0];
    expect(() => onAbandoned?.()).not.toThrow();
  });

  it("destroy stops a present timer and tolerates none", () => {
    const timer = fakeTimer();
    const ctx = Object.assign(timedPlayData(), { timer });
    ctx.destroy();
    expect(timer.stop).toHaveBeenCalledOnce();
    expect(() => timedPlayData().destroy()).not.toThrow();
  });
});

describe("resetTimerForPlayAgain", () => {
  it("stops and drops the timer and clears the store's timer fields", () => {
    const timer = fakeTimer();
    const ctx: {
      timer: SegmentTimer | null;
      $store: ReturnType<typeof store>;
    } = { timer, $store: store([PLAYER]) };
    resetTimerForPlayAgain(ctx);
    expect(timer.stop).toHaveBeenCalledOnce();
    expect(ctx.timer).toBeNull();
    expect(ctx.$store.game.timerRemainingMs).toBeNull();
    expect(ctx.$store.game.timerStartedAt).toBeNull();
    expect(ctx.$store.game.timerExpired).toBe(false);
    expect(ctx.$store.game.timerPaused).toBe(false);
  });

  it("tolerates no timer", () => {
    const ctx = { timer: null, $store: store([PLAYER]) };
    expect(() => resetTimerForPlayAgain(ctx)).not.toThrow();
  });
});

describe("resetTimerStoreFields", () => {
  it("clears the store's timer fields and leaves the timer object alone", () => {
    const timer = fakeTimer();
    const ctx: {
      timer: SegmentTimer | null;
      $store: ReturnType<typeof store>;
    } = { timer, $store: store([PLAYER]) };
    resetTimerStoreFields(ctx);
    expect(timer.stop).not.toHaveBeenCalled();
    expect(ctx.timer).toBe(timer);
    expect(ctx.$store.game.timerRemainingMs).toBeNull();
    expect(ctx.$store.game.timerStartedAt).toBeNull();
    expect(ctx.$store.game.timerExpired).toBe(false);
    expect(ctx.$store.game.timerPaused).toBe(false);
  });
});

describe("forActiveSeat", () => {
  it("reads the active seat's ref", () => {
    const read = vi.fn((seatRef: string) => `label:${seatRef}`);
    const context = { state: () => ({ activeParticipantRef: "seat-b" }) };
    expect(forActiveSeat(context, read, "")).toBe("label:seat-b");
    expect(read).toHaveBeenCalledWith("seat-b");
  });

  it("returns the fallback without reading before state exists", () => {
    const read = vi.fn((seatRef: string) => seatRef);
    expect(forActiveSeat({ state: () => null }, read, "0")).toBe("0");
    expect(read).not.toHaveBeenCalled();
  });
});

describe("seatStateFor", () => {
  const seats = [
    { participantRef: "seat-a", score: 1 },
    { participantRef: "seat-b", score: 2 },
  ];

  it("finds the seat by ref", () => {
    expect(seatStateFor({ seats }, "seat-b")).toBe(seats[1]);
  });

  it("is undefined for an unknown ref or a missing state", () => {
    expect(seatStateFor({ seats }, "nobody")).toBeUndefined();
    expect(seatStateFor(null, "seat-a")).toBeUndefined();
    expect(seatStateFor(undefined, "seat-a")).toBeUndefined();
  });
});

describe("activeSeatStateOf", () => {
  const seats = [{ participantRef: "seat-a" }, { participantRef: "seat-b" }];

  it("finds the seat whose turn it is", () => {
    expect(activeSeatStateOf({ activeParticipantRef: "seat-b", seats })).toBe(
      seats[1],
    );
  });

  it("is undefined before state exists or for a ref with no seat", () => {
    expect(activeSeatStateOf(null)).toBeUndefined();
    expect(
      activeSeatStateOf({ activeParticipantRef: "ghost", seats }),
    ).toBeUndefined();
  });
});

function checkoutScreen() {
  const facts = { stages: [], turns: [] };
  return {
    error: "stale",
    loading: true,
    finished: false,
    completionStatus: "pending" as string,
    pendingCheckoutScore: null as number | null,
    dartsAtDouble: null as 1 | 2 | 3 | null,
    dartsToFinish: null as 1 | 2 | 3 | null,
    showDoubleConfirm: false,
    scoreInput: { clear: vi.fn(), setValue: vi.fn() },
    checkoutDartOptions: vi.fn(() => ({
      toFinish: [2, 3] as (1 | 2 | 3)[],
      atDouble: [1, 2] as (1 | 2 | 3)[],
    })),
    engine: {
      record: vi.fn(),
      isComplete: vi.fn(() => false),
      facts: vi.fn(() => facts),
    },
    $store: { game: { recordFacts: vi.fn() } },
    uploadAndCompleteSession: vi.fn(async () => {}),
    maybeRunBotVisit: vi.fn(async () => {}),
  };
}

describe("checkoutDartCounts", () => {
  it("reads the confirm's dart counts, undefined while unset", () => {
    const ctx = checkoutScreen();
    expect(checkoutDartCounts(ctx)).toEqual({
      dartsUsed: undefined,
      dartsAtDouble: undefined,
    });
    ctx.dartsToFinish = 3;
    ctx.dartsAtDouble = 1;
    expect(checkoutDartCounts(ctx)).toEqual({ dartsUsed: 3, dartsAtDouble: 1 });
  });
});

describe("openCheckoutConfirm", () => {
  it("parks the score, clears the keypad and preselects the first dart options", () => {
    const ctx = checkoutScreen();
    openCheckoutConfirm(ctx, 40);
    expect(ctx).toMatchObject({
      error: "",
      pendingCheckoutScore: 40,
      dartsToFinish: 2,
      dartsAtDouble: 1,
      showDoubleConfirm: true,
      loading: true,
    });
    expect(ctx.scoreInput.clear).toHaveBeenCalledOnce();
  });
});

describe("restoreCheckoutScore", () => {
  it("puts the parked score back in the keypad and clears the confirm's fields", () => {
    const ctx = checkoutScreen();
    ctx.pendingCheckoutScore = 40;
    ctx.dartsToFinish = 2;
    ctx.dartsAtDouble = 1;
    expect(restoreCheckoutScore(ctx)).toBe(true);
    expect(ctx.scoreInput.setValue).toHaveBeenCalledWith("40");
    expect(ctx).toMatchObject({
      pendingCheckoutScore: null,
      dartsToFinish: null,
      dartsAtDouble: null,
    });
  });

  it("does nothing without a parked score", () => {
    const ctx = checkoutScreen();
    ctx.dartsToFinish = 2;
    expect(restoreCheckoutScore(ctx)).toBe(false);
    expect(ctx.scoreInput.setValue).not.toHaveBeenCalled();
    expect(ctx.dartsToFinish).toBe(2);
  });
});

describe("recordCheckoutVisit", () => {
  it("records a plain visit with no dart counts, mirrors the facts and hands over to the bot", async () => {
    const ctx = checkoutScreen();
    ctx.dartsToFinish = 3;
    await recordCheckoutVisit(ctx, 60, false);
    expect(ctx.engine.record).toHaveBeenCalledWith({
      scoreAttempted: 60,
      finishedOnDouble: false,
    });
    expect(ctx).toMatchObject({
      error: "",
      loading: false,
      dartsToFinish: null,
      dartsAtDouble: null,
    });
    expect(ctx.scoreInput.clear).toHaveBeenCalledOnce();
    expect(ctx.$store.game.recordFacts).toHaveBeenCalledWith(
      ctx.engine.facts(),
    );
    expect(ctx.maybeRunBotVisit).toHaveBeenCalledOnce();
    expect(ctx.uploadAndCompleteSession).not.toHaveBeenCalled();
  });

  it("records a double-out with the confirm's dart counts", async () => {
    const ctx = checkoutScreen();
    ctx.dartsToFinish = 2;
    ctx.dartsAtDouble = 1;
    await recordCheckoutVisit(ctx, 40, true);
    expect(ctx.engine.record).toHaveBeenCalledWith({
      scoreAttempted: 40,
      finishedOnDouble: true,
      dartsUsed: 2,
      dartsAtDouble: 1,
    });
  });

  it("finishes and uploads a completing visit instead of running the bot", async () => {
    const ctx = checkoutScreen();
    ctx.engine.isComplete.mockReturnValue(true);
    ctx.completionStatus = "failed";
    await recordCheckoutVisit(ctx, 40, true);
    expect(ctx.finished).toBe(true);
    expect(ctx.completionStatus).toBe("pending");
    expect(ctx.uploadAndCompleteSession).toHaveBeenCalledOnce();
    expect(ctx.maybeRunBotVisit).not.toHaveBeenCalled();
  });

  it("does nothing before the engine exists", async () => {
    const ctx = { ...checkoutScreen(), engine: null };
    await recordCheckoutVisit(ctx, 60, false);
    expect(ctx.error).toBe("stale");
    expect(ctx.$store.game.recordFacts).not.toHaveBeenCalled();
    expect(ctx.maybeRunBotVisit).not.toHaveBeenCalled();
  });

  it("surfaces an engine rejection and records nothing", async () => {
    const ctx = checkoutScreen();
    ctx.engine.record.mockImplementation(() => {
      throw new Error("bust");
    });
    await recordCheckoutVisit(ctx, 200, false);
    expect(ctx.error).toBe("bust");
    expect(ctx.loading).toBe(false);
    expect(ctx.scoreInput.clear).not.toHaveBeenCalled();
    expect(ctx.$store.game.recordFacts).not.toHaveBeenCalled();
    expect(ctx.maybeRunBotVisit).not.toHaveBeenCalled();
  });
});

describe("confirmCheckout", () => {
  function confirmScreen(wouldComplete: boolean) {
    return {
      finished: false,
      showDoubleConfirm: true,
      pendingCheckoutScore: 40 as number | null,
      dartsToFinish: 2 as 1 | 2 | 3 | null,
      dartsAtDouble: 1 as 1 | 2 | 3 | null,
      engine: {
        wouldComplete: vi.fn((_input: object) => wouldComplete),
      } as { wouldComplete: (input: object) => boolean } | null,
      recordVisit: vi.fn(async () => {}),
    };
  }

  it("records a non-ending checkout as a double-out and closes the confirm", async () => {
    const ctx = confirmScreen(false);
    const defer = vi.fn();
    await confirmCheckout(ctx, defer);
    expect(ctx.engine!.wouldComplete).toHaveBeenCalledWith({
      scoreAttempted: 40,
      finishedOnDouble: true,
      dartsUsed: 2,
      dartsAtDouble: 1,
    });
    expect(ctx.recordVisit).toHaveBeenCalledWith(40, true);
    expect(ctx.pendingCheckoutScore).toBeNull();
    expect(ctx.showDoubleConfirm).toBe(false);
    expect(defer).not.toHaveBeenCalled();
  });

  it("defers a session-ending checkout to the finish confirm, keeping the score parked", async () => {
    const ctx = confirmScreen(true);
    const defer = vi.fn();
    await confirmCheckout(ctx, defer);
    expect(defer).toHaveBeenCalledOnce();
    expect(ctx.showDoubleConfirm).toBe(false);
    expect(ctx.pendingCheckoutScore).toBe(40);
    expect(ctx.recordVisit).not.toHaveBeenCalled();
  });

  it("does nothing while closed, finished, engineless or with no parked score", async () => {
    const defer = vi.fn();
    const closed = { ...confirmScreen(false), showDoubleConfirm: false };
    const finished = { ...confirmScreen(false), finished: true };
    const engineless = { ...confirmScreen(false), engine: null };
    const unparked = { ...confirmScreen(false), pendingCheckoutScore: null };
    for (const ctx of [closed, finished, engineless, unparked]) {
      await confirmCheckout(ctx, defer);
      expect(ctx.recordVisit).not.toHaveBeenCalled();
    }
    expect(defer).not.toHaveBeenCalled();
    expect(unparked.showDoubleConfirm).toBe(true);
  });
});

describe("boundBoardInput", () => {
  type Page = {
    recordDart: Mock<(observation: DartObservation) => Promise<void>>;
    $store: { game: { turns: TurnFact[] } };
  };

  it("commits a board tap to the bound page's recordDart", () => {
    const board = boundBoardInput<Page>();
    const live: Page = {
      recordDart: vi.fn(async (_observation: DartObservation) => {}),
      $store: { game: { turns: [] } },
    };
    const tapped = Object.assign({}, board.data, {
      $refs: { board: fakeBoard() },
      $store: { boardInput: { handedness: "RIGHT" as const } },
    });
    board.bind(live);

    tapped.onPointerDown({
      clientX: 0,
      clientY: -102,
      preventDefault: vi.fn(),
    } as never);
    tapped.onPointerUp();

    expect(live.recordDart).toHaveBeenCalledOnce();
    expect(live.recordDart.mock.calls[0][0].hitZoneKey).toBe("TREBLE");
  });
});

describe("timedScoreScreenData", () => {
  it("composes the lifecycle state, replay starter, actions, countdown and keypad", () => {
    const data = timedScoreScreenData();
    expect(data).toMatchObject({
      ...playScreenState(),
      starterOpen: false,
      timer: null,
    });
    for (const key of [
      "back",
      "retryReconciliation",
      "visitMarkers",
      "requestPlayAgain",
      "togglePause",
      "destroy",
    ]) {
      expect(typeof (data as Record<string, unknown>)[key]).toBe("function");
    }
    expect(data.scoreInput.value).toBe("");
  });

  it("uses the countdown's abandonAndExit, which stops the timer", async () => {
    const timer = { stop: vi.fn() } as unknown as SegmentTimer;
    const ctx = Object.assign(timedScoreScreenData(), lifecycle(), { timer });
    await ctx.abandonAndExit();
    const [context, onAbandoned] = vi.mocked(playAbandonAndExit).mock.calls[0];
    expect(context).toBe(ctx);
    await onAbandoned?.();
    expect(timer.stop).toHaveBeenCalledOnce();
  });

  it("gives each page its own keypad buffer", () => {
    expect(timedScoreScreenData().scoreInput).not.toBe(
      timedScoreScreenData().scoreInput,
    );
  });
});

describe("playX01BotVisit", () => {
  function x01Screen(inputModeKey: string) {
    const ctx = Object.assign(lifecycle([PLAYER, BOT]), {
      botThrowing: false,
      botFlight: null,
      recordVisit: vi.fn(async () => {}),
    });
    ctx.$store.game.inputModeKey = inputModeKey;
    return ctx;
  }
  const factory = { create: vi.fn() } as never;
  const spec = {
    factory,
    remainingFor: vi.fn(() => 40),
    scratchRemaining: vi.fn(() => 32),
  };

  it("under VISUAL_BOARD, throws each dart at the x01 aim for the live remaining score", async () => {
    const ctx = x01Screen("VISUAL_BOARD");
    await playX01BotVisit(ctx, BOT, spec);
    const [context, botRef, thrower] = vi.mocked(playRunBotVisualBoardVisit)
      .mock.calls[0];
    expect(context).toBe(ctx);
    expect(botRef).toBe("b1");
    expect(thrower()).toEqual(
      botThrowObservation(BOT, ctx.$store.game.turns, x01BotIntent(40, BOT)),
    );
    expect(spec.remainingFor).toHaveBeenCalledWith("b1");
    expect(playBotQuickScoreVisit).not.toHaveBeenCalled();
  });

  it("under QUICK_SCORE, folds the visit against the scratch remaining score and records it as a double-out when it checks out", async () => {
    const ctx = x01Screen("QUICK_SCORE");
    vi.mocked(playBotQuickScoreVisit).mockResolvedValueOnce(40);
    await playX01BotVisit(ctx, BOT, spec);
    const [context, botSeat, passedFactory, throwDart, dartsPerVisit] =
      vi.mocked(playBotQuickScoreVisit).mock.calls[0];
    expect(context).toBe(ctx);
    expect(botSeat).toBe(BOT);
    expect(passedFactory).toBe(factory);
    expect(dartsPerVisit).toBe(3);
    const scratch = { activeParticipantRef: "b1", seats: [] };
    expect(throwDart(scratch, 4)).toEqual(
      botDartObservationAt(BOT, 4, x01BotIntent(32, BOT)),
    );
    expect(spec.scratchRemaining).toHaveBeenCalledWith(scratch, "b1");
    expect(ctx.recordVisit).toHaveBeenCalledWith(40, true);
    expect(playRunBotVisualBoardVisit).not.toHaveBeenCalled();
  });

  it("under QUICK_SCORE, records a visit short of the remaining score as no checkout", async () => {
    const ctx = x01Screen("QUICK_SCORE");
    vi.mocked(playBotQuickScoreVisit).mockResolvedValueOnce(26);
    await playX01BotVisit(ctx, BOT, spec);
    expect(ctx.recordVisit).toHaveBeenCalledWith(26, false);
  });

  it("under QUICK_SCORE, records nothing when the flight was cut short", async () => {
    const ctx = x01Screen("QUICK_SCORE");
    vi.mocked(playBotQuickScoreVisit).mockResolvedValueOnce(null);
    await playX01BotVisit(ctx, BOT, spec);
    expect(ctx.recordVisit).not.toHaveBeenCalled();
  });
});

describe("playTimedInit", () => {
  function timedScreen() {
    return Object.assign(lifecycle([PLAYER]), {
      timer: null as SegmentTimer | null,
      maybeRunBotVisit: vi.fn(async () => {}),
    });
  }

  it("runs playInit without the complete-engine upload, then the bot once a session is active", async () => {
    const ctx = timedScreen();
    vi.mocked(playInit).mockImplementationOnce(async (context) => {
      context.hasActiveSession = true;
    });
    await playTimedInit(
      ctx as never,
      "TUOD",
      resume,
      (config) => config as never,
    );
    const [context, key, passedResume, options] =
      vi.mocked(playInit).mock.calls[0];
    expect(context).toBe(ctx);
    expect(key).toBe("TUOD");
    expect(passedResume).toBe(resume);
    expect(options?.uploadIfComplete).toBe(false);
    expect(ctx.maybeRunBotVisit).toHaveBeenCalledOnce();
  });

  it("skips the bot when no session was resumed", async () => {
    const ctx = timedScreen();
    await playTimedInit(
      ctx as never,
      "TUOD",
      resume,
      (config) => config as never,
    );
    expect(ctx.maybeRunBotVisit).not.toHaveBeenCalled();
  });

  it("on resume, hands the mapped countdown config to the shared countdown", async () => {
    const ctx = timedScreen();
    ctx.$store.game.timerExpired = true;
    const countdownConfigOf = vi.fn(() => ({
      durationType: "MINUTES",
      durationValue: 5,
    }));
    await playTimedInit(ctx as never, "TUOD", resume, countdownConfigOf);
    const options = vi.mocked(playInit).mock.calls[0][3]!;
    const engine = { expireTimer: vi.fn() };
    const config = { seats: [PLAYER] };
    ctx.timer = fakeTimer();
    options.onResumed!(engine as never, config as never);
    expect(countdownConfigOf).toHaveBeenCalledWith(config);
    expect(engine.expireTimer).toHaveBeenCalledOnce();
    expect(ctx.timer).toBeNull();
  });
});

describe("playRunGatedBotVisit", () => {
  it("runs the bot's visual-board visit with the engine's wouldComplete as the finish gate", async () => {
    const ctx = Object.assign(lifecycle([PLAYER, BOT]), {
      botThrowing: false,
      botFlight: null,
    });
    const wouldComplete = vi.fn(() => true);
    ctx.engine = { wouldComplete } as never;
    const thrower = vi.fn();
    await playRunGatedBotVisit(ctx, BOT, thrower);
    const [context, botRef, passedThrower, wait, gate] = vi.mocked(
      playRunBotVisualBoardVisit,
    ).mock.calls[0];
    expect(context).toBe(ctx);
    expect(botRef).toBe("b1");
    expect(passedThrower).toBe(thrower);
    expect(wait).toBeUndefined();
    expect(gate!(MISS)).toBe(true);
    expect(wouldComplete).toHaveBeenCalledWith(MISS);
  });
});
