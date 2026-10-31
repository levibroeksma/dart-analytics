import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lib/game/play-lifecycle", () => ({
  playInit: vi.fn(async () => {}),
  playCommitDart: vi.fn(async () => {}),
  playUndoVisit: vi.fn(),
  undoToActiveSeat: vi.fn(),
  playVisitMarkers: vi.fn(() => []),
  playBack: vi.fn(async () => {}),
  playAbandonAndExit: vi.fn(async () => {}),
  playRetryReconciliation: vi.fn(async () => {}),
  playRunBotVisualBoardVisit: vi.fn(async () => {}),
  playToggleTimerPause: vi.fn(),
}));

import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playRunBotVisualBoardVisit,
  playToggleTimerPause,
  playUndoVisit,
  playVisitMarkers,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import {
  boardPlayActions,
  botVisualBoardData,
  forActiveSeat,
  playScreenActions,
  playScreenState,
  resetTimerForPlayAgain,
  timedPlayData,
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
    await ctx.undoVisit();
    expect(undoToActiveSeat).toHaveBeenCalledWith(ctx, "p1");
    expect(vi.mocked(undoToActiveSeat).mock.calls[0][0]).toBe(ctx);
    expect(playUndoVisit).not.toHaveBeenCalled();
    expect(ctx.maybeRunBotVisit).toHaveBeenCalledOnce();
  });

  it("undoVisit with a bot visit but no bot seat pops one visit", async () => {
    const ctx = Object.assign(boardScreen([PLAYER]), {
      maybeRunBotVisit: vi.fn(async () => {}),
    });
    await ctx.undoVisit();
    expect(playUndoVisit).toHaveBeenCalledWith(ctx);
    expect(undoToActiveSeat).not.toHaveBeenCalled();
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
