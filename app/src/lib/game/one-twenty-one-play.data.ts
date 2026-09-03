import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { foldOneTwentyOneState } from "@modules/game/one-twenty-one.engine.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import {
  checkoutPathFor,
  isCheckoutReachable,
} from "@modules/game/checkout-path.module";
import { checkoutDartOptions } from "@modules/game/checkout-darts.module";
import {
  participantsFromSeats,
  resolveSessionModePair,
  reseatSnapshot,
} from "@lib/game/session-mode-resolution";
import { boardInputData } from "@lib/game/board-input.data";
import { createSession, fetchActiveSessions } from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import {
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playUploadAndCompleteSession,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
import { dartsThrownCount } from "@lib/game/play-visit-stats";
import { matchWinnerName } from "@lib/game/match-result-text";
import type { RulesetVersionKey } from "@lib/types";
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  OneTwentyOneSeatState,
  OneTwentyOneState,
  TurnFact,
} from "@modules/types";
import type {
  BoardMarker,
  OneTwentyOneDurationType,
  OneTwentyOnePlayContext,
  OneTwentyOneResultsSnapshot,
  OneTwentyOneSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// oneTwentyOneEngineFactory so the registry can resolve either ruleset
// version this shared play page might be resuming.
import { OneTwentyOneEngine } from "@modules/game/one-twenty-one.engine.module";

const GAME_TYPE_KEY = "ONE_TWENTY_ONE";
const DARTS_PER_VISIT = 3;

const RESUMABLE_RULESET_VERSIONS = new Set(["121_V1", "121_V2"]);

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Accepts either ruleset version
 * — both build the same `OneTwentyOneEngine` class (Pattern 18) — since
 * `/games/121/play` is shared between them.
 */
function resumeEngine(
  game: OneTwentyOnePlayContext["$store"]["game"],
): OneTwentyOneEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (
    !configSnapshot ||
    !rulesetVersionKey ||
    !RESUMABLE_RULESET_VERSIONS.has(rulesetVersionKey)
  )
    return null;
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof OneTwentyOneEngine ? engine : null;
}

/**
 * Darts left in the currently open visit — `DARTS_PER_VISIT` when there is
 * no open visit (a fresh visit, or every visit under quick score, which
 * records a whole visit's total in one call and never leaves one open).
 */
function dartsLeftInOpenVisit(turns: readonly TurnFact[]): number {
  const open = turns.at(-1);
  if (!open || open.completedAt !== null) return DARTS_PER_VISIT;
  return DARTS_PER_VISIT - open.darts.length;
}

/**
 * Normalizes either ruleset version's config into `durationType`, mirroring
 * the engine's own `durationOf()` — `121_V1`'s snapshot carries no duration
 * fields at all, so it always reads `TARGET`.
 */
function durationTypeOf(
  config: OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"],
): OneTwentyOneDurationType {
  if (config && "durationType" in config) return config.durationType;
  return "TARGET";
}

function durationValueOf(
  config: OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"],
): number | null {
  if (config && "durationType" in config && config.durationType !== "TARGET") {
    return config.durationValue ?? null;
  }
  return null;
}

function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Starts the MINUTES countdown, resuming from the persisted remaining time
 * when a prior session left one and starting a fresh segment otherwise.
 * Mirrors `score-training-play.data.ts`'s own `startCountdown`.
 */
function startCountdown(
  game: OneTwentyOnePlayContext["$store"]["game"],
  durationValue: number,
  engine: OneTwentyOneEngine,
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
 * `init()`'s own MINUTES branch, extracted so the caller reads as one
 * decision (resume, mark already-expired, or do nothing) instead of three
 * nested conditionals. Marks the engine expired in place — via a side
 * effect, not a return value — since that outcome has nothing to hand back
 * to the caller.
 */
function maybeResumeCountdown(
  game: OneTwentyOnePlayContext["$store"]["game"],
  config: NonNullable<
    OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"]
  >,
  engine: OneTwentyOneEngine,
): SegmentTimer | null {
  if (durationTypeOf(config) !== "MINUTES") return null;
  if (game.timerExpired) {
    engine.expireTimer();
    return null;
  }
  const durationValue = durationValueOf(config);
  if (durationValue == null) return null;
  return startCountdown(game, durationValue, engine);
}

/**
 * `playAgain()`'s own MINUTES branch — always a fresh segment, since the
 * caller has already cleared the store's timer fields for the new session.
 */
function maybeStartFreshCountdown(
  game: OneTwentyOnePlayContext["$store"]["game"],
  config: NonNullable<
    OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"]
  >,
  engine: OneTwentyOneEngine,
): SegmentTimer | null {
  if (durationTypeOf(config) !== "MINUTES") return null;
  const durationValue = durationValueOf(config);
  if (durationValue == null) return null;
  return startCountdown(game, durationValue, engine);
}

/**
 * Whether `playAgain` may proceed once a config, template, and ruleset key
 * are already known to exist: the ruleset is one this shared play page can
 * resume, and no replay is already in flight. Named so the call site reads
 * as one decision rather than folding these two checks into the same
 * five-term condition as the null guards above it.
 */
function canReplay(
  rulesetVersionKey: RulesetVersionKey,
  playAgainLoading: boolean,
): boolean {
  return RESUMABLE_RULESET_VERSIONS.has(rulesetVersionKey) && !playAgainLoading;
}

/**
 * Resets every piece of local and store UI state a replay leaves behind
 * from the finished session, before the new engine is built. Extracted so
 * `playAgain` reads as its three real steps (create session, reset state,
 * build engine) rather than interleaving them with two dozen assignments.
 */
function resetForReplay(
  context: OneTwentyOnePlayContext,
  session: { sessionId: string },
  seatedSnapshot: OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"],
  modePair: { captureModeKey: string; inputModeKey: string },
): void {
  context.$store.game.sessionId = session.sessionId;
  context.$store.game.configSnapshot = seatedSnapshot;
  context.$store.game.idempotencyKey = null;
  context.$store.game.setSessionModes(modePair);
  context.$store.game.timerRemainingMs = null;
  context.$store.game.timerStartedAt = null;
  context.$store.game.timerExpired = false;

  context.finished = false;
  context.completionStatus = "pending";
  context.completionError = "";
  context.resultsSnapshot = null;
  context.pendingCheckoutScore = null;
  context.pendingDartObservation = null;
  context.showDoubleConfirm = false;
  context.showSessionFinishConfirm = false;
  clearHiddenTimer(context);
  context.scoreInput.clear();
  context.error = "";
  context.hasActiveSession = true;
}

function statsFor(
  seat: OneTwentyOneSeatState,
  turns: readonly TurnFact[],
): OneTwentyOneSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const total = seatTurns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.currentTarget,
    visits: seatTurns.length,
    average: seatTurns.length === 0 ? 0 : total / seatTurns.length,
  };
}

function computeStats(
  state: OneTwentyOneState,
  turns: readonly TurnFact[],
): OneTwentyOneResultsSnapshot {
  return {
    target: state.seats[0].currentTarget,
    winningSideKey: state.winningSideKey,
    status: state.status === "WON" ? "WON" : "COMPLETE",
    seats: state.seats.map((seat) => statsFor(seat, turns)),
  };
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` Alpine binds to
 * every directive-driven call — mirrors `five-oh-one-play.data.ts`'s own
 * `self` pattern.
 */
export function oneTwentyOnePlay() {
  let self: OneTwentyOnePlayContext;

  return {
    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
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
    resultsSnapshot: null as OneTwentyOneResultsSnapshot | null,
    pendingCheckoutScore: null as number | null,
    dartsAtDouble: null as DartCount | null,
    dartsToFinish: null as DartCount | null,
    pendingDartObservation: null as DartObservation | null,
    showDoubleConfirm: false,
    showSessionFinishConfirm: false,
    engine: null as OneTwentyOneEngine | null,
    timer: null as SegmentTimer | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    /** Overrides `boardInputData`'s own default — object-literal key order
     * means this later definition wins. Delegates to `play-lifecycle.ts`'s
     * shared implementation, mirrors `bobs27-play.data.ts`. */
    visitMarkers(this: OneTwentyOnePlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    state(this: OneTwentyOnePlayContext): OneTwentyOneState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldOneTwentyOneState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
        this.$store.game.timerExpired ?? false,
      );
    },

    remainingInAttemptFor(
      this: OneTwentyOnePlayContext,
      seatRef: string,
    ): number {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.remainingInAttempt ?? 0;
    },

    remainingInAttempt(this: OneTwentyOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.remainingInAttemptFor(state.activeParticipantRef);
    },

    currentTargetLabelFor(
      this: OneTwentyOnePlayContext,
      seatRef: string,
    ): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.currentTarget) : "";
    },

    currentTargetLabel(this: OneTwentyOnePlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    visitsThisAttemptFor(
      this: OneTwentyOnePlayContext,
      seatRef: string,
    ): number {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.visitsThisAttempt ?? 0;
    },

    visitsThisAttempt(this: OneTwentyOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.visitsThisAttemptFor(state.activeParticipantRef);
    },

    checkoutHint(this: OneTwentyOnePlayContext): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const remaining = this.remainingInAttempt();
      const dartsLeft = dartsLeftInOpenVisit(this.$store.game.turns);
      return isCheckoutReachable(remaining, dartsLeft)
        ? checkoutPathFor(remaining)!.join(" ")
        : "";
    },

    dartsThrownThisSession(this: OneTwentyOnePlayContext): number {
      return dartsThrownCount(this.$store.game.turns, DARTS_PER_VISIT);
    },

    durationType(this: OneTwentyOnePlayContext): OneTwentyOneDurationType {
      return durationTypeOf(this.$store.game.configSnapshot);
    },

    attemptLabel(this: OneTwentyOnePlayContext): string {
      const state = this.state();
      const durationValue = durationValueOf(this.$store.game.configSnapshot);
      if (!state || durationValue == null) return "";
      const attemptsCompleted = state.seats[0].attemptsCompleted;
      return `${Math.min(attemptsCompleted + 1, durationValue)} of ${durationValue}`;
    },

    remainingLabel(this: OneTwentyOnePlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    async init(this: OneTwentyOnePlayContext) {
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
        this.timer = maybeResumeCountdown(this.$store.game, config, engine);

        this.hasActiveSession = true;
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: OneTwentyOnePlayContext) {
      await this.init();
    },

    destroy(this: OneTwentyOnePlayContext) {
      this.timer?.stop();
    },

    /**
     * Which dart counts the checkout confirm may offer. The remaining score
     * the visit finished is exactly `pendingCheckoutScore` — `submitVisit`
     * only defers a visit that takes the attempt to zero — so the options are
     * read off the deferred score rather than off `remainingInAttempt()`,
     * which the dialog is open precisely to avoid moving yet.
     */
    checkoutDartOptions(this: OneTwentyOnePlayContext): CheckoutDartOptions {
      return checkoutDartOptions(this.pendingCheckoutScore ?? 0, 3);
    },

    /**
     * Folds one visit into the engine's fact log, then checks for a session
     * win. Shared by the plain-reduction path (`submitVisit`) and both
     * checkout confirm (`confirmDouble`) so the
     * record → mirror → complete sequence exists exactly once.
     */
    async recordVisit(
      this: OneTwentyOnePlayContext,
      score: number,
      finishedOnDouble: boolean,
    ) {
      if (!this.engine) return;
      const darts = finishedOnDouble
        ? {
            dartsUsed: this.dartsToFinish ?? undefined,
            dartsAtDouble: this.dartsAtDouble ?? undefined,
          }
        : {};
      try {
        this.engine.record({
          scoreAttempted: score,
          finishedOnDouble,
          ...darts,
        });
      } catch (err: unknown) {
        this.error = (err as Error).message;
        this.loading = false;
        return;
      }
      this.error = "";
      this.scoreInput.clear();
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.$store.game.recordFacts(this.engine.facts());
      this.loading = false;

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    /**
     * The board's per-dart counterpart to `recordVisit`: every dart the
     * player throws arrives here from `boardInputData`'s `onCommit`. A dart
     * that would complete the whole session is gated behind
     * `showSessionFinishConfirm`, because recording it uploads and completes
     * the session immediately and that step is irreversible; a
     * ladder-climbing checkout or a bust commits straight away — mirrors
     * `five-oh-one-play.data.ts`'s `recordDart`.
     */
    async recordDart(
      this: OneTwentyOnePlayContext,
      observation: DartObservation,
    ) {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm
      )
        return;

      if (this.engine.wouldComplete(observation)) {
        this.pendingDartObservation = observation;
        this.showSessionFinishConfirm = true;
        return;
      }

      await this.commitDart(observation);
    },

    commitDart(
      this: OneTwentyOnePlayContext,
      observation: DartObservation,
    ): Promise<void> {
      return playCommitDart(this, observation);
    },

    /**
     * 121 is double-out but this app's keypad only captures a visit's total,
     * not individual darts — so when the entered score would bring the
     * attempt's remaining total to exactly 0, the app cannot know from the
     * number alone whether the last dart was a double (a checkout) or not (a
     * bust). `isCheckoutAttempt` gates a "Finished on a double?" confirm
     * before anything is recorded; every other visit records immediately.
     * `checkoutPathFor` narrows that gate to remainders a double-out finish
     * can actually reach, mirroring `five-oh-one-play.data.ts`'s
     * `submitVisit`.
     */
    async submitVisit(this: OneTwentyOnePlayContext) {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm
      )
        return;
      this.loading = true;

      const score = Number(this.scoreInput.value);
      const remaining = this.remainingInAttempt();
      const isCheckoutAttempt =
        remaining - score === 0 &&
        score <= 180 &&
        checkoutPathFor(remaining) !== null;

      if (isCheckoutAttempt) {
        this.error = "";
        this.pendingCheckoutScore = score;
        this.scoreInput.clear();
        const options = this.checkoutDartOptions();
        this.dartsAtDouble = options.atDouble[0];
        this.dartsToFinish = options.toFinish[0];
        this.showDoubleConfirm = true;
        this.loading = false;
        return;
      }

      await this.recordVisit(score, false);
    },

    /**
     * "Yes" on the double-out confirm. A checkout that only climbs the
     * ladder records immediately. A checkout at the cap target (170) wins
     * the whole session and is irreversible once uploaded, so this asks
     * `engine.wouldComplete` and opens a second confirm instead of
     * recording right away, mirroring `five-oh-one-play.data.ts`'s
     * `confirmDouble`.
     */
    async confirmDouble(this: OneTwentyOnePlayContext) {
      if (!this.engine || this.finished || !this.showDoubleConfirm) return;
      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;

      if (
        this.engine.wouldComplete({
          scoreAttempted: score,
          finishedOnDouble: true,
          dartsUsed: this.dartsToFinish ?? undefined,
          dartsAtDouble: this.dartsAtDouble ?? undefined,
        })
      ) {
        this.showDoubleConfirm = false;
        this.showSessionFinishConfirm = true;
        return;
      }

      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordVisit(score, true);
    },

    cancelCheckout(this: OneTwentyOnePlayContext) {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.showDoubleConfirm = false;
    },

    /**
     * Confirm on the second, session-ending dialog: records whichever the
     * player was deferred on — the board's dart (`recordDart`'s gate) or the
     * keypad's checkout (`confirmDouble`'s deferral) — mirrors
     * `five-oh-one-play.data.ts`'s `confirmMatchFinish`.
     */
    async confirmSessionFinish(this: OneTwentyOnePlayContext) {
      if (!this.engine || this.finished || !this.showSessionFinishConfirm)
        return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showSessionFinishConfirm = false;
        await this.commitDart(observation);
        return;
      }

      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showSessionFinishConfirm = false;
      await this.recordVisit(score, true);
    },

    /**
     * Cancel on the second, session-ending dialog. Nothing is recorded; a
     * deferred keypad score returns to the keypad, a deferred dart is simply
     * discarded (the player throws again) — mirrors
     * `five-oh-one-play.data.ts`'s `cancelMatchFinish`.
     */
    cancelSessionFinish(this: OneTwentyOnePlayContext) {
      if (!this.showSessionFinishConfirm) return;

      if (this.pendingDartObservation) {
        this.pendingDartObservation = null;
        this.showSessionFinishConfirm = false;
        return;
      }

      if (this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.showSessionFinishConfirm = false;
    },

    undoVisit(this: OneTwentyOnePlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm
      )
        return;
      if (!this.engine || !this.engine.undo()) return;

      clearHiddenTimer(this);
      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },

    async uploadAndCompleteSession(
      this: OneTwentyOnePlayContext,
    ): Promise<void> {
      return playUploadAndCompleteSession(
        this,
        (finalState) => computeStats(finalState, this.$store.game.turns),
        () => this.state(),
      );
    },

    resultsTitle(this: OneTwentyOnePlayContext): string {
      if (this.resultsSnapshot?.status !== "WON") return "Session complete";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      return winner ? `${winner} checks out 170!` : "170 checked out!";
    },

    async back(this: OneTwentyOnePlayContext) {
      return playBack(this);
    },

    async abandonAndExit(this: OneTwentyOnePlayContext) {
      return playAbandonAndExit(this, () => this.timer?.stop());
    },

    /**
     * Replays the same configuration template the first session used, against
     * whichever ruleset version that session actually used — `121_V1` stays
     * on `121_V1`, `121_V2` stays on `121_V2` and its own `duration_type`/
     * `duration_value`.
     */
    async playAgain(this: OneTwentyOnePlayContext) {
      const config = this.$store.game.configSnapshot;
      const templateRef = this.$store.game.templateRef;
      const rulesetVersionKey = this.$store.game.rulesetVersionKey;
      if (!config || !templateRef || !rulesetVersionKey) return;
      if (!canReplay(rulesetVersionKey, this.playAgainLoading)) return;
      const factory = getEngineFactory(rulesetVersionKey);
      if (!factory) return;

      this.playAgainLoading = true;
      this.playAgainError = "";

      const modePair = resolveSessionModePair(
        rulesetVersionKey,
        this.$store.settings,
      );

      try {
        let session;
        try {
          session = await createSession({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey,
            captureModeKey: modePair.captureModeKey,
            inputModeKey: modePair.inputModeKey,
            config: { source: "template", templateRef },
            participants: participantsFromSeats(config.seats),
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        const seatedSnapshot = reseatSnapshot(config, session.participants);
        resetForReplay(this, session, seatedSnapshot, modePair);

        const engine = factory.create(seatedSnapshot);
        if (!(engine instanceof OneTwentyOneEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());

        const freshTimer = maybeStartFreshCountdown(
          this.$store.game,
          seatedSnapshot,
          engine,
        );
        if (freshTimer) {
          this.timer?.stop();
          this.timer = freshTimer;
        }
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
