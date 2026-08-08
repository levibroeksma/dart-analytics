import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import {
  applyFiveOhOneVisit,
  initialFiveOhOneState,
} from "@modules/game/five-oh-one.engine.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import {
  dartsThrownCount,
  previousScoreDisplay,
  threeDartAverageDisplay,
} from "@lib/game/play-visit-stats";
import type { RulesetVersionKey, FiveOhOneSnapshot } from "@lib/types";
import type { EngineFacts, FiveOhOneState, TurnFact } from "@modules/types";
import type { FiveOhOnePlayContext } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// fiveOhOneEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { FiveOhOneEngine } from "@modules/game/five-oh-one.engine.module";

const GAME_TYPE_KEY = "501";
const RULESET_VERSION_KEY: RulesetVersionKey = "501_V1";

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Only this page's own ruleset is
 * ever resolved — mirrors `score-training-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: FiveOhOnePlayContext["$store"]["game"],
): FiveOhOneEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof FiveOhOneEngine ? engine : null;
}

/**
 * Folds a leg's turns into a `FiveOhOneState`, exactly like the engine's own
 * private replay, but reading only from the reactive `$store.game` fields —
 * never `engine.state()` — so every Alpine display expression that calls
 * this (directly or through `remainingScore`/`checkoutHint`/the stat
 * methods) re-renders when `recordFacts` writes a new turn. `engine` is a
 * plain class instance; its own internal mutations carry no Alpine
 * reactivity, so display must never depend on them (see
 * `07-Frontend/03-Alpine-Patterns.md`'s reactive-store convention, already
 * followed by `ScoreTrainingResults.astro`).
 */
function foldLegState(
  turns: TurnFact[],
  config: FiveOhOneSnapshot,
): FiveOhOneState {
  return turns.reduce(
    (state, turn) =>
      applyFiveOhOneVisit(
        state,
        { scoreAttempted: turn.totalScore, finishedOnDouble: true },
        config,
      ),
    initialFiveOhOneState(config),
  );
}

/**
 * The engine owns the fact log while a session is live; the store mirrors
 * it. Upload paths that can run without a live engine (a completion retry
 * driven straight from the results modal) fall back to the persisted
 * mirror — mirrors `score-training-play.data.ts`'s `currentFacts`.
 */
function currentFacts(context: FiveOhOnePlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

/**
 * Match-wide summary for the results modal.
 *
 * `legsWon` is the caller's `config.legsToWin`, never `stages.length`: a stage
 * exists per leg *played*, and a Best-of-5 won 3-1 played four legs while
 * winning three. This function only ever runs on the completion path, which
 * `record()` reaches exactly when `legsWon` hits `legsToWin` — so the
 * configured target is the legs actually won, by definition.
 *
 * `average` is per-visit, matching Score Training. For 501 that equals the
 * 3-dart average for every full visit; the checkout visit may have used fewer
 * than three darts, which this slightly under-weights. Recovering it needs
 * per-dart capture, which 501 does not have (`06-Spec/04-Runtime-Layer.md`).
 */
function computeStats(
  turns: TurnFact[],
  legsWon: number,
): { total: number; legs: number; average: number } {
  const total = turns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return {
    total,
    legs: legsWon,
    average: turns.length === 0 ? 0 : total / turns.length,
  };
}

export function fiveOhOnePlay() {
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
      total: number;
      legs: number;
      average: number;
    } | null,
    pendingCheckoutScore: null as number | null,
    showDoubleConfirm: false,
    showMatchFinishConfirm: false,
    engine: null as FiveOhOneEngine | null,

    turnsInCurrentLeg(this: FiveOhOnePlayContext): TurnFact[] {
      const openLeg = this.$store.game.stages.at(-1);
      if (!openLeg) return [];
      return this.$store.game.turns.filter(
        (turn) => turn.stageClientKey === openLeg.clientKey,
      );
    },

    remainingScore(this: FiveOhOnePlayContext): number {
      const config = this.$store.game.configSnapshot;
      if (!config) return 0;
      return foldLegState(this.turnsInCurrentLeg(), config).remainingScore;
    },

    checkoutHint(this: FiveOhOnePlayContext): string {
      const path = checkoutPathFor(this.remainingScore());
      return path ? path.join(" ") : "";
    },

    dartsThrownThisLeg(this: FiveOhOnePlayContext): number {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return dartsThrownCount(this.turnsInCurrentLeg().length, maxDartsPerTurn);
    },

    averageThisLeg(this: FiveOhOnePlayContext): string {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return threeDartAverageDisplay(this.turnsInCurrentLeg(), maxDartsPerTurn);
    },

    previousScoreThisLeg(this: FiveOhOnePlayContext): string {
      return previousScoreDisplay(this.turnsInCurrentLeg());
    },

    async init(this: FiveOhOnePlayContext) {
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

        if (result.action === "no_active") {
          this.hasActiveSession = false;
          return;
        }

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

    async retryReconciliation(this: FiveOhOnePlayContext) {
      await this.init();
    },

    /**
     * Folds one visit into the engine's fact log, then checks for a match
     * win. Shared by the plain-reduction path (`submitVisit`) and both
     * double-confirm resolutions (`confirmDouble`/`denyDouble`) so the
     * record → mirror → complete sequence exists exactly once.
     */
    async recordVisit(
      this: FiveOhOnePlayContext,
      score: number,
      finishedOnDouble: boolean,
    ) {
      if (!this.engine) return;
      try {
        this.engine.record({ scoreAttempted: score, finishedOnDouble });
      } catch (err: unknown) {
        this.error = (err as Error).message;
        this.loading = false;
        return;
      }
      this.error = "";
      this.scoreInput.clear();
      this.$store.game.recordFacts(this.engine.facts());
      this.loading = false;

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    /**
     * 501 is double-out but this app only captures a visit's total, not
     * individual darts — so when the entered score would bring the leg's
     * remaining total to exactly 0, the app cannot know from the number
     * alone whether the last dart was a double (a win) or not (a bust).
     * `isCheckoutAttempt` gates a "Finished on a double?" confirm before
     * anything is recorded; every other visit records immediately.
     *
     * `checkoutPathFor` narrows that gate to remainders a double-out finish
     * can actually reach: the seven bogey numbers and 171-180 have no legal
     * finish route, so a "Yes" answer there could never be true. Those visits
     * skip the dialog and fall straight through to `recordVisit` as a bust,
     * which the engine's own bust rule already produces for a zeroing visit
     * with `finishedOnDouble: false`.
     */
    async submitVisit(this: FiveOhOnePlayContext) {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showMatchFinishConfirm
      )
        return;
      this.loading = true;

      const score = Number(this.scoreInput.value);
      const config = this.$store.game.configSnapshot;
      const remaining = this.remainingScore();
      const isCheckoutAttempt =
        !!config &&
        remaining - score === 0 &&
        score <= config.maxVisitScore &&
        checkoutPathFor(remaining) !== null;

      if (isCheckoutAttempt) {
        this.error = "";
        this.pendingCheckoutScore = score;
        this.scoreInput.clear();
        this.showDoubleConfirm = true;
        this.loading = false;
        return;
      }

      await this.recordVisit(score, false);
    },

    /**
     * "Yes" on the double-out confirm. A checkout that only wins a leg
     * records immediately, same as before this dialog existed. A checkout
     * that wins the whole match is irreversible once uploaded — `recordVisit`
     * marks the session `finished` and `PATCH COMPLETED`s it — so this asks
     * `engine.wouldComplete` (a pure predicate, matches D181: match-win, not
     * leg-win) and opens a second confirm instead of recording right away.
     * `pendingCheckoutScore` is deliberately left set for that second dialog
     * to record or restore.
     */
    async confirmDouble(this: FiveOhOnePlayContext) {
      if (!this.engine || this.finished || !this.showDoubleConfirm) return;
      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;

      if (
        this.engine.wouldComplete({
          scoreAttempted: score,
          finishedOnDouble: true,
        })
      ) {
        this.showDoubleConfirm = false;
        this.showMatchFinishConfirm = true;
        return;
      }

      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordVisit(score, true);
    },

    async denyDouble(this: FiveOhOnePlayContext) {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordVisit(score, false);
    },

    /**
     * Cancel on the double-out confirm. Mirrors Score Training's
     * `cancelFinish`: nothing is recorded, and the pending score is restored
     * into the keypad so a mistyped entry is not lost.
     */
    cancelCheckout(this: FiveOhOnePlayContext) {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
    },

    /**
     * Confirm on the second, match-ending dialog: records the checkout that
     * `confirmDouble` deferred, which drives `recordVisit`'s own completion
     * check and upload.
     */
    async confirmMatchFinish(this: FiveOhOnePlayContext) {
      if (!this.engine || this.finished || !this.showMatchFinishConfirm) return;
      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showMatchFinishConfirm = false;
      await this.recordVisit(score, true);
    },

    /**
     * Cancel on the second, match-ending dialog. Same contract as
     * `cancelCheckout`: nothing is recorded, and the score returns to the
     * keypad rather than being lost.
     */
    cancelMatchFinish(this: FiveOhOnePlayContext) {
      if (!this.showMatchFinishConfirm || this.pendingCheckoutScore == null)
        return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.showMatchFinishConfirm = false;
    },

    undoVisit(this: FiveOhOnePlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showMatchFinishConfirm
      )
        return;
      if (!this.engine || !this.engine.undo()) return;

      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },

    /**
     * Uploads the fact log, then marks the session COMPLETED. On this path
     * only, SESSION_ALREADY_COMPLETED counts as success. Stats are copied into
     * `resultsSnapshot` before any store mutation so the results modal never
     * depends on `$store.game.turns` surviving a later reset.
     */
    async uploadAndCompleteSession(this: FiveOhOnePlayContext): Promise<void> {
      const sessionId = this.$store.game.sessionId!;

      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      this.completionStatus = "saving";
      this.completionError = "";

      try {
        const batch = buildEventsBatch(
          this.$store.game.participantRef!,
          currentFacts(this),
        );
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

      this.resultsSnapshot = computeStats(
        this.$store.game.turns,
        this.$store.game.configSnapshot!.legsToWin,
      );
      this.completionStatus = "succeeded";
    },

    async back(this: FiveOhOnePlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: FiveOhOnePlayContext) {
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
          const batch = buildEventsBatch(
            this.$store.game.participantRef!,
            facts,
          );
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
     * Replays the same configuration template the first session used. Store
     * and UI are mutated only once the new session exists: on failure the
     * modal stays open with the results visible and the buttons enabled,
     * since the prior session is already COMPLETED.
     */
    async playAgain(this: FiveOhOnePlayContext) {
      const config = this.$store.game.configSnapshot;
      const templateRef = this.$store.game.templateRef;
      if (!config || !templateRef || this.playAgainLoading) return;
      const factory = getEngineFactory(RULESET_VERSION_KEY);
      if (!factory) return;

      this.playAgainLoading = true;
      this.playAgainError = "";

      try {
        let session;
        try {
          session = await createSession({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey: RULESET_VERSION_KEY,
            captureModeKey: "RECREATIONAL",
            inputModeKey: "QUICK_SCORE",
            config: {
              source: "template",
              templateRef,
              overrides: { legs_to_win: config.legsToWin },
            },
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
        this.$store.game.idempotencyKey = null;

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingCheckoutScore = null;
        this.showDoubleConfirm = false;
        this.showMatchFinishConfirm = false;
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
        if (!(engine instanceof FiveOhOneEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
