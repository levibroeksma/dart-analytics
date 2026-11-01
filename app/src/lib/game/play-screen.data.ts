import { boardInputData } from "@lib/game/board-input.data";
import { findBotSeat } from "@lib/game/play-bot-seat";
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
  undoPastBot,
} from "@lib/game/play-lifecycle";
import type { DartbotSeat } from "@lib/types";
import type { GameEngine } from "@modules/interfaces";
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  EngineFacts,
  MultiSeatState,
} from "@modules/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type {
  BoardMarker,
  BotDartThrower,
  BotFlight,
  PlayLifecycleContext,
  PlayStoreContext,
} from "./types";

type ScreenContext = PlayLifecycleContext<
  unknown,
  GameEngine<DartObservation, unknown>,
  unknown
>;

type BotScreenContext = PlayLifecycleContext<
  unknown,
  GameEngine<DartObservation, MultiSeatState>,
  unknown
> & {
  botThrowing: boolean;
  botFlight?: BotFlight | null;
};

type BoardPlayContext<
  TConfig,
  TEngine extends GameEngine<DartObservation, MultiSeatState>,
> = PlayLifecycleContext<TConfig, TEngine, unknown> & {
  recordDart(observation: DartObservation): Promise<void>;
  commitDart(observation: DartObservation): Promise<void>;
  maybeRunBotVisit?(): Promise<void>;
};

type CheckoutConfirmContext = {
  error: string;
  pendingCheckoutScore: number | null;
  dartsAtDouble: DartCount | null;
  dartsToFinish: DartCount | null;
  showDoubleConfirm: boolean;
  scoreInput: { clear(): void; setValue(value: string): void };
  checkoutDartOptions(): CheckoutDartOptions;
};

type CheckoutVisitContext = Omit<
  CheckoutConfirmContext,
  "showDoubleConfirm" | "checkoutDartOptions"
> & {
  loading: boolean;
  finished: boolean;
  completionStatus: string;
  engine: {
    record(input: {
      scoreAttempted: number;
      finishedOnDouble: boolean;
      dartsUsed?: DartCount;
      dartsAtDouble?: DartCount;
    }): unknown;
    isComplete(): boolean;
    facts(): EngineFacts;
  } | null;
  $store: { game: { recordFacts(facts: EngineFacts): void } };
  uploadAndCompleteSession(): Promise<void>;
  maybeRunBotVisit(): Promise<void>;
};

type TimerStoreContext = {
  timer: SegmentTimer | null;
  $store: {
    game: Pick<
      PlayStoreContext<unknown>["game"],
      "timerRemainingMs" | "timerStartedAt" | "timerExpired" | "timerPaused"
    >;
  };
};

/**
 * The lifecycle state fields every play factory declares, at their initial
 * values. A fresh object per call; spread it into the factory.
 */
export function playScreenState<TEngine, TResults>() {
  return {
    loading: false,
    error: "",
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    completionStatus: "pending" as
      "pending" | "saving" | "succeeded" | "failed",
    completionError: "",
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null as TResults | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as TEngine | null,
  };
}

/**
 * The navigation and recovery actions every play page shares. A timed page
 * spreads `timedPlayData()` after this, so its `abandonAndExit` wins.
 */
export function playScreenActions() {
  return {
    back(this: ScreenContext) {
      return playBack(this);
    },

    retryReconciliation(this: ScreenContext) {
      return playRetryReconciliation(this);
    },

    visitMarkers(this: ScreenContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    abandonAndExit(this: ScreenContext) {
      return playAbandonAndExit(this);
    },
  };
}

/**
 * The visual-board record cycle: board input wired to `recordDart`, plus
 * `init`, `recordDart`, `commitDart`, `undoVisit` and the lifecycle's
 * `visitMarkers`. Each step re-enters `maybeRunBotVisit` when the page has
 * one. `afterInit` runs after `playInit` and before the bot visit, for a
 * page's own post-resume step such as a countdown. `init` binds the board's
 * commit to this page: a factory that overrides `init` must call through to
 * this one, or board taps break.
 */
export function boardPlayActions<
  TConfig,
  TEngine extends GameEngine<DartObservation, MultiSeatState>,
>(spec: {
  gameTypeKey: string;
  resume: (game: PlayStoreContext<TConfig>["game"]) => TEngine | null;
  afterInit?(context: BoardPlayContext<TConfig, TEngine>): void | Promise<void>;
}) {
  let self: BoardPlayContext<TConfig, TEngine>;

  return {
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    async init(this: BoardPlayContext<TConfig, TEngine>) {
      self = this;
      await playInit(this, spec.gameTypeKey, spec.resume);
      await spec.afterInit?.(this);
      await this.maybeRunBotVisit?.();
    },

    async recordDart(
      this: BoardPlayContext<TConfig, TEngine>,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    async commitDart(
      this: BoardPlayContext<TConfig, TEngine>,
      observation: DartObservation,
    ) {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit?.();
    },

    async undoVisit(this: BoardPlayContext<TConfig, TEngine>) {
      if (!this.maybeRunBotVisit) {
        playUndoVisit(this);
        return;
      }
      if (!undoPastBot(this)) playUndoVisit(this);
      await this.maybeRunBotVisit();
    },

    visitMarkers(this: BoardPlayContext<TConfig, TEngine>): BoardMarker[] {
      return playVisitMarkers(this);
    },
  };
}

/**
 * A seated DartBot's visual-board visit: `throwBotDart` picks each dart for
 * the bot seat, and the lifecycle animates and records it (08-DartBot.md).
 */
export function botVisualBoardData<TContext>(
  throwBotDart: (
    context: TContext,
    botSeat: DartbotSeat,
  ) => ReturnType<BotDartThrower>,
) {
  return {
    botThrowing: false,
    botFlight: null as BotFlight | null,

    async maybeRunBotVisit(this: BotScreenContext & TContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat) return;
      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },
  };
}

/**
 * A MINUTES-mode countdown's state and its pause, teardown and abandon
 * actions. Spread after `playScreenActions()`; its `abandonAndExit` stops
 * the countdown once the session is abandoned.
 */
export function timedPlayData() {
  return {
    timer: null as SegmentTimer | null,

    togglePause(this: ScreenContext & { timer: SegmentTimer | null }) {
      playToggleTimerPause(this);
    },

    destroy(this: { timer: SegmentTimer | null }) {
      this.timer?.stop();
    },

    abandonAndExit(this: ScreenContext & { timer: SegmentTimer | null }) {
      return playAbandonAndExit(this, () => this.timer?.stop());
    },
  };
}

/**
 * `read` for the seat whose turn it is, or `fallback` before the engine state
 * exists. Pairs each per-seat `xFor(seatRef)` with its active-seat `x()`.
 */
export function forActiveSeat<T>(
  context: { state(): { activeParticipantRef: string } | null },
  read: (seatRef: string) => T,
  fallback: T,
): T {
  const state = context.state();
  return state ? read(state.activeParticipantRef) : fallback;
}

/** The seat with `seatRef` in a folded state; undefined for a null state or an unknown ref. */
export function seatStateFor<TSeat extends { participantRef: string }>(
  state: { seats: readonly TSeat[] } | null | undefined,
  seatRef: string,
): TSeat | undefined {
  return state?.seats.find((seat) => seat.participantRef === seatRef);
}

/** The seat whose turn it is; undefined before state exists. */
export function activeSeatStateOf<TSeat extends { participantRef: string }>(
  state:
    | { activeParticipantRef: string; seats: readonly TSeat[] }
    | null
    | undefined,
): TSeat | undefined {
  return state ? seatStateFor(state, state.activeParticipantRef) : undefined;
}

/** Clears the store's countdown fields; the page's own timer object is left as is. */
export function resetTimerStoreFields(
  context: Pick<TimerStoreContext, "$store">,
): void {
  context.$store.game.timerRemainingMs = null;
  context.$store.game.timerStartedAt = null;
  context.$store.game.timerExpired = false;
  context.$store.game.timerPaused = false;
}

/** Stops and drops the countdown and clears the store's timer fields before a replay. */
export function resetTimerForPlayAgain(context: TimerStoreContext): void {
  context.timer?.stop();
  context.timer = null;
  resetTimerStoreFields(context);
}

/** The checkout confirm's dart counts, undefined while unanswered. */
export function checkoutDartCounts(
  context: Pick<CheckoutConfirmContext, "dartsAtDouble" | "dartsToFinish">,
): { dartsUsed: DartCount | undefined; dartsAtDouble: DartCount | undefined } {
  return {
    dartsUsed: context.dartsToFinish ?? undefined,
    dartsAtDouble: context.dartsAtDouble ?? undefined,
  };
}

/** Parks `score` behind the double-out confirm, preselecting the first dart-count options. */
export function openCheckoutConfirm(
  context: CheckoutConfirmContext,
  score: number,
): void {
  context.error = "";
  context.pendingCheckoutScore = score;
  context.scoreInput.clear();
  const options = context.checkoutDartOptions();
  context.dartsAtDouble = options.atDouble[0];
  context.dartsToFinish = options.toFinish[0];
  context.showDoubleConfirm = true;
}

/**
 * Returns the parked checkout score to the keypad and clears the confirm's
 * fields; false, changing nothing, when no score is parked.
 */
export function restoreCheckoutScore(
  context: Omit<
    CheckoutConfirmContext,
    "error" | "showDoubleConfirm" | "checkoutDartOptions"
  >,
): boolean {
  if (context.pendingCheckoutScore == null) return false;
  context.scoreInput.setValue(String(context.pendingCheckoutScore));
  context.pendingCheckoutScore = null;
  context.dartsAtDouble = null;
  context.dartsToFinish = null;
  return true;
}

/**
 * Records one x01 visit total, with the confirm's dart counts on a
 * double-out, mirrors the facts, then finishes and uploads a completing
 * visit or hands over to the bot. An engine rejection surfaces as `error`.
 */
export async function recordCheckoutVisit(
  context: CheckoutVisitContext,
  score: number,
  finishedOnDouble: boolean,
): Promise<void> {
  const engine = context.engine;
  if (!engine) return;
  const darts = finishedOnDouble ? checkoutDartCounts(context) : {};
  try {
    engine.record({ scoreAttempted: score, finishedOnDouble, ...darts });
  } catch (err: unknown) {
    context.error = (err as Error).message;
    context.loading = false;
    return;
  }
  context.error = "";
  context.scoreInput.clear();
  context.dartsAtDouble = null;
  context.dartsToFinish = null;
  context.$store.game.recordFacts(engine.facts());
  context.loading = false;

  if (engine.isComplete()) {
    context.finished = true;
    context.completionStatus = "pending";
    await context.uploadAndCompleteSession();
    return;
  }
  await context.maybeRunBotVisit();
}

/**
 * "Yes" on the double-out confirm: records the parked score as a double-out,
 * or, when that would end the session, closes this confirm and calls
 * `deferToFinishConfirm` with the score still parked for the second dialog.
 */
export async function confirmCheckout(
  context: Pick<
    CheckoutConfirmContext,
    | "pendingCheckoutScore"
    | "dartsAtDouble"
    | "dartsToFinish"
    | "showDoubleConfirm"
  > & {
    finished: boolean;
    engine: {
      wouldComplete(input: {
        scoreAttempted: number;
        finishedOnDouble: boolean;
        dartsUsed?: DartCount;
        dartsAtDouble?: DartCount;
      }): boolean;
    } | null;
    recordVisit(score: number, finishedOnDouble: boolean): Promise<void>;
  },
  deferToFinishConfirm: () => void,
): Promise<void> {
  if (!context.engine || context.finished || !context.showDoubleConfirm) return;
  if (context.pendingCheckoutScore == null) return;
  const score = context.pendingCheckoutScore;

  if (
    context.engine.wouldComplete({
      scoreAttempted: score,
      finishedOnDouble: true,
      ...checkoutDartCounts(context),
    })
  ) {
    context.showDoubleConfirm = false;
    deferToFinishConfirm();
    return;
  }

  context.pendingCheckoutScore = null;
  context.showDoubleConfirm = false;
  await context.recordVisit(score, true);
}
