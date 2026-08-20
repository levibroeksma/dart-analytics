import { getEngineFactory } from "@modules/game/engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { resolveSessionModePair } from "@lib/game/session-mode-resolution";
import type { RulesetVersionKey } from "@lib/types";
import type { EngineFacts, TuodAttemptInput, TurnFact } from "@modules/types";
import type { TuodPlayContext, TuodResultsSnapshot } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// tuodEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  TuodEngine,
  applyTuodAttempt,
  initialTuodState,
} from "@modules/game/tuod.engine.module";

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

/**
 * The engine owns the fact log while a session is live; the store mirrors it.
 * Upload paths that can run without a live engine (a completion retry driven
 * straight from the results modal) fall back to the persisted mirror.
 */
function currentFacts(context: TuodPlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

/**
 * Folds the fact log into the ladder's final resting state using the same
 * pure reducer the engine replays with — never re-derives the ladder math
 * separately.
 */
function computeStats(
  turns: readonly TurnFact[],
  config: TuodPlayContext["$store"]["game"]["configSnapshot"],
): TuodResultsSnapshot {
  const state = turns.reduce(
    (s, turn) => applyTuodAttempt(config!, s, turn.totalScore > 0),
    initialTuodState(config!),
  );
  return {
    target: state.currentTarget,
    attempts: state.attempts,
    successes: state.successes,
    failures: state.failures,
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

export function tuodPlay() {
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
    pendingAttempt: null as boolean | null,
    showFinishConfirm: false,
    engine: null as TuodEngine | null,
    timer: null as SegmentTimer | null,

    currentTargetLabel(this: TuodPlayContext): string {
      return String(this.engine?.state().currentTarget ?? "");
    },

    remainingLabel(this: TuodPlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    /**
     * D88 auto-cleanup via shared reconcileActiveSession helper. On "match",
     * resume silently: the engine is rebuilt from the persisted facts and the
     * store is written back from `engine.facts()` immediately.
     */
    async init(this: TuodPlayContext) {
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
     * Records one attempt directly — there is no typed score to confirm, so
     * the only gate is `wouldComplete`, which defers a session-ending attempt
     * to the finish confirm exactly as every other quick-score game does.
     */
    async recordAttempt(
      this: TuodPlayContext,
      checkedOut: boolean,
    ): Promise<void> {
      if (!this.engine || this.finished || this.showFinishConfirm) return;
      const input: TuodAttemptInput = {
        checkedOut,
        finishedOnDouble: checkedOut,
      };

      if (this.engine.wouldComplete(input)) {
        this.error = "";
        this.pendingAttempt = checkedOut;
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
      this.$store.game.recordFacts(this.engine.facts());
    },

    async confirmFinish(this: TuodPlayContext): Promise<void> {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;
      if (this.pendingAttempt === null) return;

      const input: TuodAttemptInput = {
        checkedOut: this.pendingAttempt,
        finishedOnDouble: this.pendingAttempt,
      };
      this.pendingAttempt = null;
      this.showFinishConfirm = false;

      this.engine.record(input);
      this.$store.game.recordFacts(this.engine.facts());

      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },

    cancelFinish(this: TuodPlayContext) {
      if (!this.showFinishConfirm) return;
      this.pendingAttempt = null;
      this.showFinishConfirm = false;
    },

    undoAttempt(this: TuodPlayContext) {
      if (this.finished || this.showFinishConfirm) return;
      if (!this.engine || !this.engine.undo()) return;

      this.$store.game.recordFacts(this.engine.facts());
      this.error = "";
    },

    async uploadAndCompleteSession(this: TuodPlayContext): Promise<void> {
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
        this.$store.game.configSnapshot,
      );
      this.completionStatus = "succeeded";
    },

    async back(this: TuodPlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: TuodPlayContext) {
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
        this.timer?.stop();
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },

    /**
     * Replays the same configuration template the first session used — V1
     * has nothing to override, unlike Score Training's `duration_value`.
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
            },
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
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
        this.showFinishConfirm = false;
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
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
