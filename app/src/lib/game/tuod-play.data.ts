import { matchWinnerName } from "@lib/game/match-result-text";
import { checkoutDartOptions } from "@modules/game/checkout-darts.module";
import {
  checkoutPathFor,
  checkoutPathWithin,
} from "@modules/game/checkout-path.module";
import { boardInputData } from "@lib/game/board-input.data";
import {
  boundBoardInput,
  checkoutDartCounts,
  openCheckoutConfirm,
  playRunGatedBotVisit,
  playTimedInit,
  resetTimerStoreFields,
  restoreCheckoutScore,
  timedScoreScreenData,
} from "@lib/game/play-screen.data";
import {
  armHiddenTimer,
  playFoldBotQuickScoreVisit,
  playUploadAndCompleteSession,
  resumeGameEngine,
  runPlayAgain,
  isInputBlocked,
  undoBotAwareVisit,
  playBotQuickScoreVisit,
} from "@lib/game/play-lifecycle";
import {
  checkoutPercentageDisplay,
  dartsLeftForSeat,
} from "@lib/game/play-visit-stats";
import {
  activeBotTurn,
  botDartObservationAt,
  botThrowObservation,
  x01BotIntent,
} from "@lib/game/play-bot-seat";
import { formatRemaining, restartCountdown } from "@lib/game/play-countdown";
import { classifyDoubleAttempts } from "@modules/game/double-attempt.module";
import { tuodCheckoutVisits } from "@modules/game/checkout-visits.module";
import type {
  DartbotSeat,
  RulesetVersionKey,
  Seated,
  TuodSnapshot,
} from "@lib/types";
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  EngineFacts,
  TuodAttemptInput,
  TuodSeatState,
  TuodState,
} from "@modules/types";
import type {
  BotPacing,
  TuodPlayContext,
  TuodResultsSnapshot,
  TuodSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// tuodEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY. `tuodEngineFactory` is imported directly (not via the
// type-erased registry) so `playFoldBotQuickScoreVisit`'s `TState` infers as
// `TuodState` with no cast at the call site.
import {
  TuodEngine,
  foldTuodState,
  tuodEngineFactory,
} from "@modules/game/tuod.engine.module";

const GAME_TYPE_KEY = "TUOD";
const RULESET_VERSION_KEY: RulesetVersionKey = "TUOD_V1";

const DARTS_PER_VISIT = 3;

/** VISUAL_BOARD thrower: TUOD's "remaining" for a fresh attempt is the
 * seat's own `currentTarget` — an attempt always starts at the ladder
 * target, unlike 121/501's visit-to-visit carry. Reads the typed state
 * directly (never the formatted `currentTargetLabelFor` display helper). */
function throwBotDart(
  context: TuodPlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const seat = context
    .state()
    ?.seats.find(
      (candidate) => candidate.participantRef === botSeat.participantRef,
    );
  return botThrowObservation(
    botSeat,
    context.$store.game.turns,
    x01BotIntent(seat?.currentTarget ?? 0, botSeat),
  );
}

/** QUICK_SCORE thrower: `state` is the scratch engine's own live state,
 * never the real engine's — mirrors `five-oh-one-play.data.ts`. */
function throwBotQuickScoreDart(
  state: TuodState,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const remaining = state.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  )!.currentTarget;
  return botDartObservationAt(
    botSeat,
    dartIndex,
    x01BotIntent(remaining, botSeat),
  );
}

function statsFor(
  seat: TuodSeatState,
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  inputModeKey: string | null,
): TuodSeatResult {
  const seatTurns = facts.turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const checkoutPercentage = (() => {
    if (inputModeKey !== "VISUAL_BOARD") return null;
    const { hits, misses } = classifyDoubleAttempts(
      tuodCheckoutVisits(seatTurns, facts, config, seat.participantRef),
    );
    return checkoutPercentageDisplay(hits, hits + misses);
  })();
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.currentTarget,
    checkoutPercentage,
  };
}

/**
 * `status` collapses the engine's own three-way `status` to the two
 * outcomes a finished session can report, so a genuine TIE (both seats
 * reach the same target) stays distinguishable from a solo session even
 * though both leave `winningSideKey` `null`: solo sessions never see `TIE`
 * from the engine (score-compare only runs seats.length >= 2), so this
 * collapse is safe.
 */
function computeStats(
  state: TuodState,
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  inputModeKey: string | null,
): TuodResultsSnapshot {
  return {
    winningSideKey: state.winningSideKey,
    status: state.status === "TIE" ? "TIE" : "COMPLETE",
    seats: state.seats.map((seat) =>
      statsFor(seat, facts, config, inputModeKey),
    ),
  };
}

/** Whether `submitVisit` may record an attempt right now. */
function canSubmitVisit(context: TuodPlayContext): boolean {
  return (
    !!context.engine &&
    !context.finished &&
    !context.showDoubleConfirm &&
    !context.showFinishConfirm &&
    !context.$store.game.timerPaused
  );
}

/** `init` binds the board input to the live component (`boundBoardInput`). */
export function tuodPlay() {
  const board = boundBoardInput<TuodPlayContext>();

  return {
    ...board.data,
    ...timedScoreScreenData<TuodEngine, TuodResultsSnapshot>(),
    pendingAttempt: null as TuodAttemptInput | null,
    pendingCheckoutScore: null as number | null,
    pendingDartObservation: null as DartObservation | null,
    dartsAtDouble: null as DartCount | null,
    dartsToFinish: null as DartCount | null,
    showDoubleConfirm: false,
    showFinishConfirm: false,
    botThrowing: false,
    botFlight: null,

    /**
     * Folds the store's own fact log — never `engine.state()` — so every
     * Alpine display expression that calls this re-renders when
     * `recordFacts` writes a new turn. The engine is a plain class instance;
     * its internal mutations carry no Alpine reactivity (see
     * `07-Frontend/03-Alpine-Patterns.md`'s reactive-store convention).
     */
    state(this: TuodPlayContext): TuodState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldTuodState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
        this.$store.game.timerExpired ?? false,
      );
    },

    currentTargetLabelFor(this: TuodPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.currentTarget) : "";
    },

    currentTargetLabel(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    remainingInAttemptFor(this: TuodPlayContext, seatRef: string): number {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.remainingInAttempt ?? 0;
    },

    remainingInAttempt(this: TuodPlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.remainingInAttemptFor(state.activeParticipantRef);
    },

    /**
     * Play-header subtitle: the throwing seat's next attempt (`ATTEMPT 4`),
     * `ATTEMPT 4 OF 10` against a ROUNDS budget, held at the last attempt
     * once it is spent; blank before config loads.
     */
    subtitle(this: TuodPlayContext): string {
      const state = this.state();
      const config = this.$store.game.configSnapshot;
      if (!state || !config) return "";
      const attempt = this.attemptsFor(state.activeParticipantRef) + 1;
      if (config.durationType !== "ROUNDS") return `ATTEMPT ${attempt}`;
      const rounds = config.durationValue;
      return `ATTEMPT ${Math.min(attempt, rounds)} OF ${rounds}`;
    },

    attemptsFor(this: TuodPlayContext, seatRef: string): number {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.attempts ?? 0;
    },

    attempts(this: TuodPlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.attemptsFor(state.activeParticipantRef);
    },

    /** The seat's resolved attempts as `successes · failures` (`3 · 1`). */
    successFailureFor(this: TuodPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return `${seat?.successes ?? 0} · ${seat?.failures ?? 0}`;
    },

    successFailure(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "0 · 0";
      return this.successFailureFor(state.activeParticipantRef);
    },

    /**
     * The finish route for what the seat still has left in the open attempt,
     * blank when no route fits the darts it has left (#291). Reads
     * `remainingInAttempt`, not `currentTarget`, so the hint tracks the
     * score the player is actually throwing at (#202) — mirrors
     * `one-twenty-one-play.data.ts`'s own `checkoutHint`.
     */
    checkoutHintFor(this: TuodPlayContext, seatRef: string): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const remaining = this.remainingInAttemptFor(seatRef);
      const dartsLeft = dartsLeftForSeat(
        this.$store.game.turns,
        seatRef,
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? DARTS_PER_VISIT,
      );
      return checkoutPathWithin(remaining, dartsLeft)?.join(" ") ?? "";
    },

    checkoutHint(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.checkoutHintFor(state.activeParticipantRef);
    },

    remainingLabel(this: TuodPlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    /**
     * Which dart counts the checkout confirm may offer. The score being
     * finished is the target the attempt was thrown at, held in
     * `pendingCheckoutScore` while the dialog is open — the ladder has not
     * moved yet, so reading it back off the engine would give the same
     * number, but only until the attempt is recorded.
     */
    checkoutDartOptions(this: TuodPlayContext): CheckoutDartOptions {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return checkoutDartOptions(
        this.pendingCheckoutScore ?? 0,
        maxDartsPerTurn,
      );
    },

    /**
     * Reconciles via the shared reconcileActiveSession helper. On "match",
     * resume silently: the engine is rebuilt from the persisted facts and the
     * store is written back from `engine.facts()` immediately. Any other
     * outcome shows no session; nothing is abandoned here (D460).
     */
    async init(this: TuodPlayContext) {
      board.bind(this);
      await playTimedInit(
        this,
        GAME_TYPE_KEY,
        (game) =>
          resumeGameEngine<TuodSnapshot, TuodEngine>(
            game,
            RULESET_VERSION_KEY,
            (candidate): candidate is TuodEngine =>
              candidate instanceof TuodEngine,
          ),
        (config) => config,
      );
    },

    /**
     * Submits the typed visit total. TUOD's only meaningful total is the
     * target itself — that is what a checkout scores — so an entry that
     * matches the target opens the checkout confirm and every other entry is
     * a failed attempt, recorded straight away. A target the checkout chart
     * has no route for can never be checked out, so it skips the dialog the
     * same way 501 skips it for a bogey number.
     */
    async submitVisit(this: TuodPlayContext): Promise<void> {
      this.timer?.unlockAudio();
      if (!canSubmitVisit(this)) return;

      const score = Number(this.scoreInput.value);
      const activeState = this.state();
      const target =
        activeState?.seats.find(
          (seat) => seat.participantRef === activeState.activeParticipantRef,
        )?.currentTarget ?? 0;

      if (score === target && checkoutPathFor(target) !== null) {
        openCheckoutConfirm(this, score);
        return;
      }

      await this.recordAttempt({ checkedOut: false });
    },

    /** "Confirm" on the checkout dialog: a checkout finished on a double. */
    async confirmDouble(this: TuodPlayContext): Promise<void> {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordAttempt({
        checkedOut: true,
        finishedOnDouble: true,
        ...checkoutDartCounts(this),
      });
    },

    /**
     * Cancel on the checkout dialog: nothing is recorded and the typed total
     * goes back into the keypad, so a mistyped entry is not lost.
     */
    cancelCheckout(this: TuodPlayContext) {
      if (!this.showDoubleConfirm) return;
      if (restoreCheckoutScore(this)) this.showDoubleConfirm = false;
    },

    /**
     * Folds one resolved attempt into the engine's fact log. Shared by the
     * plain-failure path (`submitVisit`) and the checkout confirm
     * (`confirmDouble`) so the record → mirror sequence exists
     * exactly once. `wouldComplete` defers a session-ending attempt to the
     * finish confirm exactly as every other quick-score game does.
     */
    async recordAttempt(
      this: TuodPlayContext,
      input: TuodAttemptInput,
    ): Promise<void> {
      if (
        !this.engine ||
        this.finished ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;

      if (this.engine.wouldComplete(input)) {
        this.error = "";
        this.pendingAttempt = input;
        this.showFinishConfirm = true;
        return;
      }

      try {
        this.engine.record(input);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }

      this.error = "";
      this.scoreInput.clear();
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.$store.game.recordFacts(this.engine.facts());
      await this.maybeRunBotVisit();
    },

    async maybeRunBotVisit(this: TuodPlayContext) {
      if (this.$store.game.timerPaused) return;
      const turn = activeBotTurn(this);
      if (!turn) return;
      const { botSeat, state } = turn;

      if (this.$store.game.inputModeKey === "QUICK_SCORE") {
        const target = state.seats.find(
          (seat) => seat.participantRef === botSeat.participantRef,
        )!.currentTarget;
        const total = await playBotQuickScoreVisit(
          this,
          botSeat,
          tuodEngineFactory,
          (scratchState, dartIndex) =>
            throwBotQuickScoreDart(scratchState, botSeat, dartIndex),
          DARTS_PER_VISIT,
        );
        if (total === null) return;
        await this.recordAttempt({
          checkedOut: total === target,
          finishedOnDouble: total === target,
        });
        return;
      }

      await playRunGatedBotVisit(this, botSeat, () =>
        throwBotDart(this, botSeat),
      );
    },

    /**
     * The board's per-dart counterpart to `recordAttempt`: every dart the
     * player throws arrives here from `boardInputData`'s `onCommit`. A dart
     * that would end the session is gated behind `showFinishConfirm` — the
     * same dialog the keypad path defers to — because recording it uploads
     * and completes the session immediately and that step is irreversible;
     * any other dart commits straight away. Mirrors
     * `one-twenty-one-play.data.ts`'s `recordDart`.
     */
    async recordDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      this.timer?.unlockAudio();
      if (
        !this.engine ||
        this.finished ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;

      if (this.engine.wouldComplete(observation)) {
        this.error = "";
        this.pendingDartObservation = observation;
        this.showFinishConfirm = true;
        return;
      }

      await this.commitDart(observation);
    },

    /**
     * Records one dart and mirrors it into the store — never inferring
     * completion from a post-record `isComplete()` read, unlike the shared
     * `playCommitDart` this used to delegate to. A solo MINUTES session's
     * `isComplete()` can already read true — timer expired, at least one
     * prior visit closed — before the dart just recorded has resolved the
     * CURRENT visit (`tuodSpec.complete` counts closed attempts only), and a
     * generic post-record check cannot tell the difference. `recordDart`'s
     * own pre-record `wouldComplete()` gate is the sole completion signal;
     * `confirmFinish` ends the session explicitly for the dart it defers.
     * Mirrors `score-training-play.data.ts`'s own `recordDart`.
     */
    async commitDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      if (!this.engine || this.$store.game.timerPaused) return;
      try {
        this.engine.record(observation);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }
      this.error = "";
      const facts = this.engine.facts();
      this.$store.game.recordFacts(facts);
      armHiddenTimer(this, facts.turns);
      await this.maybeRunBotVisit();
    },

    async confirmFinish(this: TuodPlayContext): Promise<void> {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        this.engine.record(observation);
        this.$store.game.recordFacts(this.engine.facts());
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
        return;
      }

      if (this.pendingAttempt === null) return;
      const input = this.pendingAttempt;
      this.pendingAttempt = null;
      this.showFinishConfirm = false;

      this.engine.record(input);
      this.scoreInput.clear();
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.$store.game.recordFacts(this.engine.facts());

      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },

    cancelFinish(this: TuodPlayContext) {
      if (!this.showFinishConfirm) return;
      this.pendingAttempt = null;
      this.pendingDartObservation = null;
      this.showFinishConfirm = false;
    },

    undoVisit(this: TuodPlayContext) {
      if (isInputBlocked(this, this.showDoubleConfirm, this.showFinishConfirm))
        return;
      undoBotAwareVisit(this);
    },

    async uploadAndCompleteSession(this: TuodPlayContext): Promise<void> {
      return playUploadAndCompleteSession(
        this,
        (finalState) =>
          computeStats(
            finalState,
            { stages: this.$store.game.stages, turns: this.$store.game.turns },
            this.$store.game.configSnapshot!,
            this.$store.game.inputModeKey,
          ),
        () => this.state(),
      );
    },

    resultsTitle(this: TuodPlayContext): string {
      if (this.resultsSnapshot?.status === "TIE") return "Tie — same target!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      return winner ? `${winner} wins — highest target!` : "Game Summary";
    },

    /**
     * Replays with the session's own duration as an override — the same
     * carry-over `score-training-play.data.ts`'s `playAgain()` does.
     * Delegates to `play-lifecycle.ts`'s shared `runPlayAgain`. Unlike
     * 501/121/Score Training's own `playAgain`, this reset callback does not
     * call `scoreInput.clear()` — preserved exactly as this file's own
     * pre-existing asymmetry, not added or removed by this refactor.
     */
    async playAgain(this: TuodPlayContext) {
      await runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof TuodEngine ? engine : null),
        (config) => ({
          snapshot: config,
          wire: { duration_value: config.durationValue },
        }),
        () => {
          resetTimerStoreFields(this);
          this.pendingAttempt = null;
          this.pendingDartObservation = null;
          this.showFinishConfirm = false;
        },
        (engine) =>
          restartCountdown(this, this.$store.game.configSnapshot, engine),
      );
    },
  };
}
