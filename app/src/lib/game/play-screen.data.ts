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
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import type { DartbotSeat } from "@lib/types";
import type { GameEngine } from "@modules/interfaces";
import type { DartObservation, MultiSeatState } from "@modules/types";
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
 * The navigation and recovery actions every play page shares. `abandonAndExit`
 * stops the page's countdown, when it has one, once the session is abandoned.
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

    abandonAndExit(this: ScreenContext & { timer?: SegmentTimer | null }) {
      return playAbandonAndExit(this, () => this.timer?.stop());
    },
  };
}

/**
 * The visual-board record cycle: board input wired to `recordDart`, plus
 * `init`, `recordDart`, `commitDart`, `undoVisit` and the lifecycle's
 * `visitMarkers`. Each step re-enters `maybeRunBotVisit` when the page has
 * one. `init` binds the board's commit to this page, so a page that overrides
 * `init` must still run this one.
 */
export function boardPlayActions<
  TConfig,
  TEngine extends GameEngine<DartObservation, MultiSeatState>,
>(spec: {
  gameTypeKey: string;
  resume: (game: PlayStoreContext<TConfig>["game"]) => TEngine | null;
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
      const seats = this.$store.game.seats;
      if (findBotSeat(seats)) {
        const humanSeat = seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )!;
        undoToActiveSeat(this, humanSeat.participantRef);
      } else {
        playUndoVisit(this);
      }
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

/** A MINUTES-mode countdown's state and its pause and teardown actions. */
export function timedPlayData() {
  return {
    timer: null as SegmentTimer | null,

    togglePause(this: ScreenContext & { timer: SegmentTimer | null }) {
      playToggleTimerPause(this);
    },

    destroy(this: { timer: SegmentTimer | null }) {
      this.timer?.stop();
    },
  };
}

/** Stops and drops the countdown and clears the store's timer fields before a replay. */
export function resetTimerForPlayAgain(context: TimerStoreContext): void {
  context.timer?.stop();
  context.timer = null;
  context.$store.game.timerRemainingMs = null;
  context.$store.game.timerStartedAt = null;
  context.$store.game.timerExpired = false;
  context.$store.game.timerPaused = false;
}
