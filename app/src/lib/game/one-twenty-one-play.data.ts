import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { foldOneTwentyOneState } from "@modules/game/one-twenty-one.engine.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { checkoutDartOptions } from "@modules/game/checkout-darts.module";
import {
  participantsFromSeats,
  resolveSessionModePair,
  reseatSnapshot,
} from "@lib/game/session-mode-resolution";
import { boardInputData } from "@lib/game/board-input.data";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { dartsThrownCount } from "@lib/game/play-visit-stats";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  EngineFacts,
  OneTwentyOneState,
  TurnFact,
} from "@modules/types";
import type { OneTwentyOnePlayContext } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// oneTwentyOneEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { OneTwentyOneEngine } from "@modules/game/one-twenty-one.engine.module";

const GAME_TYPE_KEY = "ONE_TWENTY_ONE";
const RULESET_VERSION_KEY: RulesetVersionKey = "121_V1";
const DARTS_PER_VISIT = 3;

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors `five-oh-one-play.data
 * .ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: OneTwentyOnePlayContext["$store"]["game"],
): OneTwentyOneEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof OneTwentyOneEngine ? engine : null;
}

/**
 * The engine owns the fact log while a session is live; the store mirrors
 * it. Upload paths that can run without a live engine (a completion retry
 * driven straight from the results modal) fall back to the persisted
 * mirror — mirrors `five-oh-one-play.data.ts`'s `currentFacts`.
 */
function currentFacts(context: OneTwentyOnePlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

/**
 * The seat this session belongs to — the one PLAYER participant. Mirrors
 * `five-oh-one-play.data.ts`'s `ownerRef`.
 */
function ownerRef(seats: readonly SeatFact[]): string | null {
  return (
    seats.find((seat) => seat.participantTypeKey === "PLAYER")
      ?.participantRef ?? null
  );
}

function computeStats(
  state: OneTwentyOneState,
  turns: TurnFact[],
  owner: string | null,
): {
  target: number;
  visits: number;
  average: number;
  winningSideKey: string | null;
} {
  const ownerTurns =
    owner === null
      ? turns
      : turns.filter((turn) => turn.participantRef === owner);
  const total = ownerTurns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return {
    target: 170,
    visits: ownerTurns.length,
    average: ownerTurns.length === 0 ? 0 : total / ownerTurns.length,
    winningSideKey: state.winningSideKey,
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
    resultsSnapshot: null as {
      target: number;
      visits: number;
      average: number;
      winningSideKey: string | null;
    } | null,
    pendingCheckoutScore: null as number | null,
    dartsAtDouble: null as DartCount | null,
    dartsToFinish: null as DartCount | null,
    pendingDartObservation: null as DartObservation | null,
    showDoubleConfirm: false,
    showSessionFinishConfirm: false,
    engine: null as OneTwentyOneEngine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    state(this: OneTwentyOnePlayContext): OneTwentyOneState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldOneTwentyOneState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
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
      const path = checkoutPathFor(this.remainingInAttempt());
      return path ? path.join(" ") : "";
    },

    dartsThrownThisSession(this: OneTwentyOnePlayContext): number {
      return dartsThrownCount(this.$store.game.turns, DARTS_PER_VISIT);
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

    /**
     * Records one dart against the engine and refreshes displayed state
     * exactly as `recordVisit` does for a whole visit — shared by the
     * immediate path (`recordDart`) and the deferred session-finish confirm
     * (`confirmSessionFinish`).
     */
    async commitDart(
      this: OneTwentyOnePlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine) return;
      this.engine.record(observation);
      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
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

      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },

    /**
     * Uploads the fact log, then marks the session COMPLETED. On this path
     * only, SESSION_ALREADY_COMPLETED counts as success. Stats are copied
     * into `resultsSnapshot` before any store mutation so the results modal
     * never depends on `$store.game.turns` surviving a later reset.
     */
    async uploadAndCompleteSession(
      this: OneTwentyOnePlayContext,
    ): Promise<void> {
      const sessionId = this.$store.game.sessionId!;

      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      this.completionStatus = "saving";
      this.completionError = "";

      try {
        const batch = buildEventsBatch(currentFacts(this));
        await appendBatch(sessionId, idempotencyKey, batch);
        await completeSession(sessionId, "COMPLETED");
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        const alreadyCompleted =
          error.code === "SESSION_ALREADY_COMPLETED" ||
          error.message?.includes("SESSION_ALREADY_COMPLETED");
        if (!alreadyCompleted) {
          this.completionError =
            "Could not save your game. Check your connection and retry.";
          this.completionStatus = "failed";
          return;
        }
      }

      const finalState = this.state();
      if (finalState) {
        this.resultsSnapshot = computeStats(
          finalState,
          this.$store.game.turns,
          ownerRef(this.$store.game.seats),
        );
      }
      this.completionStatus = "succeeded";
    },

    async back(this: OneTwentyOnePlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: OneTwentyOnePlayContext) {
      if (this.$store.game.loading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.$store.game.loading = true;
      this.error = "";
      try {
        const facts = currentFacts(this);
        if (facts.turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const batch = buildEventsBatch(facts);
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },

    /**
     * Replays the same configuration template the first session used — 121
     * has zero editable settings, so no overrides.
     */
    async playAgain(this: OneTwentyOnePlayContext) {
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
            config: { source: "template", templateRef },
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

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingCheckoutScore = null;
        this.pendingDartObservation = null;
        this.showDoubleConfirm = false;
        this.showSessionFinishConfirm = false;
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(seatedSnapshot);
        if (!(engine instanceof OneTwentyOneEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
