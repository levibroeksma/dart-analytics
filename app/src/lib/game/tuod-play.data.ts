import { getEngineFactory } from "@modules/game/engine.registry";
import { matchWinnerName } from "@lib/game/match-result-text";
import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { checkoutDartOptions } from "@modules/game/checkout-darts.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { createSession, fetchActiveSessions } from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import {
  participantsFromSeats,
  resolveSessionModePair,
  reseatSnapshot,
} from "@lib/game/session-mode-resolution";
import { boardInputData } from "@lib/game/board-input.data";
import {
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playUploadAndCompleteSession,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
import type { RulesetVersionKey } from "@lib/types";
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  TuodAttemptInput,
  TuodSeatState,
  TuodState,
} from "@modules/types";
import type {
  BoardMarker,
  TuodPlayContext,
  TuodResultsSnapshot,
  TuodSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// tuodEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { TuodEngine, foldTuodState } from "@modules/game/tuod.engine.module";

const GAME_TYPE_KEY = "TUOD";
const RULESET_VERSION_KEY: RulesetVersionKey = "TUOD_V1";

function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the ladder exactly. Mirrors
 * `score-training-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: TuodPlayContext["$store"]["game"],
): TuodEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof TuodEngine ? engine : null;
}

function statsFor(seat: TuodSeatState): TuodSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.currentTarget,
    attempts: seat.attempts,
    successes: seat.successes,
    failures: seat.failures,
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
function computeStats(state: TuodState): TuodResultsSnapshot {
  return {
    winningSideKey: state.winningSideKey,
    status: state.status === "TIE" ? "TIE" : "COMPLETE",
    seats: state.seats.map((seat) => statsFor(seat)),
  };
}

/**
 * Starts the MINUTES countdown, resuming from the persisted remaining time
 * when a prior session left one and starting a fresh segment otherwise.
 * Mirrors `score-training-play.data.ts`'s `startCountdown`.
 */
function startCountdown(
  game: TuodPlayContext["$store"]["game"],
  durationValue: number,
  engine: TuodEngine,
): SegmentTimer {
  const resumedRemainingMs = game.timerRemainingMs;
  const durationMinutes =
    resumedRemainingMs != null ? resumedRemainingMs / 60000 : durationValue;

  game.timerRemainingMs = durationMinutes * 60000;
  if (resumedRemainingMs == null) {
    game.timerStartedAt = new Date().toISOString();
  }

  const timer = new SegmentTimer({
    totalMinutes: durationMinutes,
    intervalMinutes: durationMinutes,
    onTick: (secondsRemaining) => {
      game.timerRemainingMs = secondsRemaining * 1000;
    },
    onComplete: () => {
      game.timerExpired = true;
      engine.expireTimer();
    },
  });
  timer.start();
  return timer;
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` Alpine binds to every
 * directive-driven call — mirrors `one-twenty-one-play.data.ts`'s own `self`
 * pattern.
 */
export function tuodPlay() {
  let self: TuodPlayContext;

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
    resultsSnapshot: null as TuodResultsSnapshot | null,
    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
    pendingAttempt: null as TuodAttemptInput | null,
    pendingCheckoutScore: null as number | null,
    pendingDartObservation: null as DartObservation | null,
    dartsAtDouble: null as DartCount | null,
    dartsToFinish: null as DartCount | null,
    showDoubleConfirm: false,
    showFinishConfirm: false,
    engine: null as TuodEngine | null,
    timer: null as SegmentTimer | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    /** Overrides `boardInputData`'s own default — object-literal key order
     * means this later definition wins. Delegates to `play-lifecycle.ts`'s
     * shared implementation, mirrors `bobs27-play.data.ts`. */
    visitMarkers(this: TuodPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

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

    checkoutHintFor(this: TuodPlayContext, seatRef: string): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      const path = seat ? checkoutPathFor(seat.currentTarget) : null;
      return path ? path.join(" ") : "";
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
     * D88 auto-cleanup via shared reconcileActiveSession helper. On "match",
     * resume silently: the engine is rebuilt from the persisted facts and the
     * store is written back from `engine.facts()` immediately.
     */
    async init(this: TuodPlayContext) {
      self = this;
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        const result = await reconcileActiveSession(
          GAME_TYPE_KEY,
          this.$store.game.sessionId,
          activeSessions,
          this.$store.game,
        );

        if (result.action === "abandon_failed") {
          this.reconciliationFailed = true;
          this.hasActiveSession = false;
          return;
        }
        this.reconciliationFailed = false;

        if (result.action === "no_active" || !result.activeSession) {
          this.hasActiveSession = false;
          return;
        }

        this.$store.game.setSessionModes(result.activeSession);

        const config = this.$store.game.configSnapshot;
        const engine = resumeEngine(this.$store.game);
        if (!config || !engine) {
          this.hasActiveSession = false;
          return;
        }
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());

        if (config.durationType === "MINUTES") {
          if (this.$store.game.timerExpired) {
            engine.expireTimer();
          } else {
            this.timer = startCountdown(
              this.$store.game,
              config.durationValue,
              engine,
            );
          }
        }

        this.hasActiveSession = true;
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: TuodPlayContext) {
      await this.init();
    },

    destroy(this: TuodPlayContext) {
      this.timer?.stop();
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
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showFinishConfirm
      )
        return;

      const score = Number(this.scoreInput.value);
      const activeState = this.state();
      const target =
        activeState?.seats.find(
          (seat) => seat.participantRef === activeState.activeParticipantRef,
        )?.currentTarget ?? 0;

      if (score === target && checkoutPathFor(target) !== null) {
        this.error = "";
        this.pendingCheckoutScore = score;
        this.scoreInput.clear();
        const options = this.checkoutDartOptions();
        this.dartsAtDouble = options.atDouble[0];
        this.dartsToFinish = options.toFinish[0];
        this.showDoubleConfirm = true;
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
        dartsUsed: this.dartsToFinish ?? undefined,
        dartsAtDouble: this.dartsAtDouble ?? undefined,
      });
    },

    /**
     * Cancel on the checkout dialog: nothing is recorded and the typed total
     * goes back into the keypad, so a mistyped entry is not lost.
     */
    cancelCheckout(this: TuodPlayContext) {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.showDoubleConfirm = false;
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
      if (!this.engine || this.finished || this.showFinishConfirm) return;

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
      if (!this.engine || this.finished || this.showFinishConfirm) return;

      if (this.engine.wouldComplete(observation)) {
        this.error = "";
        this.pendingDartObservation = observation;
        this.showFinishConfirm = true;
        return;
      }

      await this.commitDart(observation);
    },

    commitDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      return playCommitDart(this, observation);
    },

    async confirmFinish(this: TuodPlayContext): Promise<void> {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        await this.commitDart(observation);
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
      if (this.finished || this.showDoubleConfirm || this.showFinishConfirm)
        return;
      if (!this.engine || !this.engine.undo()) return;

      clearHiddenTimer(this);
      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },

    async uploadAndCompleteSession(this: TuodPlayContext): Promise<void> {
      return playUploadAndCompleteSession(
        this,
        (finalState) => computeStats(finalState),
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

    async back(this: TuodPlayContext) {
      return playBack(this);
    },

    async abandonAndExit(this: TuodPlayContext) {
      return playAbandonAndExit(this, () => this.timer?.stop());
    },

    /**
     * Replays with the session's own duration as an override — the same
     * carry-over `score-training-play.data.ts`'s `playAgain()` does. Without
     * it, a replayed custom-duration session would silently persist the
     * template's default `duration_value` instead of the value actually
     * played.
     */
    async playAgain(this: TuodPlayContext) {
      const config = this.$store.game.configSnapshot;
      const templateRef = this.$store.game.templateRef;
      if (!config || !templateRef || this.playAgainLoading) return;
      const factory = getEngineFactory(RULESET_VERSION_KEY);
      if (!factory) return;

      this.playAgainLoading = true;
      this.playAgainError = "";

      const modePair = resolveSessionModePair(
        RULESET_VERSION_KEY,
        this.$store.settings,
      );

      try {
        let session;
        try {
          session = await createSession({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey: RULESET_VERSION_KEY,
            captureModeKey: modePair.captureModeKey,
            inputModeKey: modePair.inputModeKey,
            config: {
              source: "template",
              templateRef,
              overrides: { duration_value: config.durationValue },
            },
            participants: participantsFromSeats(config.seats),
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        const seatedSnapshot = reseatSnapshot(config, session.participants);

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.configSnapshot = seatedSnapshot;
        this.$store.game.idempotencyKey = null;
        this.$store.game.setSessionModes(modePair);
        this.$store.game.timerRemainingMs = null;
        this.$store.game.timerStartedAt = null;
        this.$store.game.timerExpired = false;

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingAttempt = null;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        clearHiddenTimer(this);
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(seatedSnapshot);
        if (!(engine instanceof TuodEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());

        if (config.durationType === "MINUTES") {
          this.timer?.stop();
          this.timer = startCountdown(
            this.$store.game,
            config.durationValue,
            engine,
          );
        }
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
