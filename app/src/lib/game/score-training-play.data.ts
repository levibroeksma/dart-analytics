import { ScoreInputBuffer } from "@modules/game/score-input.module";
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
import type { RulesetVersionKey } from "@lib/types";
import type { EngineFacts, TurnFact } from "@modules/types";
import type { ScoreTrainingPlayContext } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// scoreTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";

const GAME_TYPE_KEY = "SCORE_TRAINING";
const RULESET_VERSION_KEY: RulesetVersionKey = "SCORE_TRAINING_V1";

function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function computeStats(turns: TurnFact[]): {
  total: number;
  visits: number;
  average: number;
} {
  const visits = turns.length;
  const total = turns.reduce((sum, t) => sum + t.totalScore, 0);
  return { total, visits, average: visits === 0 ? 0 : total / visits };
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly.
 *
 * Only this page's own ruleset is ever resolved: a store still holding another
 * game's `rulesetVersionKey` must not build that game's engine here, however
 * the shared registry would happily hand one over once every game registers.
 *
 * @returns null when the store holds no config to resume from, when its
 *   ruleset belongs to a different game, when no engine is registered, or when
 *   the registered factory builds something other than a Score Training engine.
 */
function resumeEngine(
  game: ScoreTrainingPlayContext["$store"]["game"],
): ScoreTrainingEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof ScoreTrainingEngine ? engine : null;
}

/**
 * Starts the MINUTES countdown, resuming from the persisted remaining time
 * when a prior session left one and starting a fresh segment otherwise.
 * `timerRemainingMs` is set synchronously so the label never renders 00:00
 * while waiting for the timer's first onTick (which fires 1s after start()).
 * Expiry is written to both authorities it governs: the persisted store flag
 * that survives a reload, and the engine, which owns session completion.
 */
function startCountdown(
  game: ScoreTrainingPlayContext["$store"]["game"],
  durationValue: number,
  engine: ScoreTrainingEngine,
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
 * The engine owns the fact log while a session is live; the store mirrors it.
 * Upload paths that can run without a live engine (a completion retry driven
 * straight from the results modal) fall back to the persisted mirror.
 */
function currentFacts(context: ScoreTrainingPlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

export function scoreTrainingPlay() {
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
    abandonLoading: false,
    resultsSnapshot: null as {
      total: number;
      visits: number;
      average: number;
    } | null,
    pendingFinishScore: null as number | null,
    showFinishConfirm: false,
    engine: null as ScoreTrainingEngine | null,
    timer: null as SegmentTimer | null,

    remainingLabel(this: ScoreTrainingPlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    /**
     * D88 auto-cleanup via shared reconcileActiveSession helper.
     *
     * On "match", resume silently (no Continue/Abandon modal — that is
     * setup-only): the engine is rebuilt from the persisted facts and the
     * store is written back from `engine.facts()` immediately, so the two
     * agree before any input. On "abandon_failed", stay on the loading/error
     * view rather than flipping to "no active session" as if it were cleaned.
     */
    async init(this: ScoreTrainingPlayContext) {
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

    async retryReconciliation(this: ScoreTrainingPlayContext) {
      await this.init();
    },

    destroy(this: ScoreTrainingPlayContext) {
      this.timer?.stop();
    },

    /**
     * The engine is the sole authority on both the score range and completion,
     * including MINUTES-mode timer expiry, which reaches it through
     * `expireTimer()` when the countdown fires rather than through a write to
     * a returned state object. `wouldComplete` gates the finish confirm without
     * mutating the fact log, so a finishing visit is recorded exactly once — by
     * `confirmFinish`, after the player agrees. A score the engine would reject
     * never reports as completing, so it falls through to `record` and surfaces
     * its error.
     */
    async submitVisit(this: ScoreTrainingPlayContext) {
      if (!this.engine || this.finished || this.showFinishConfirm) return;
      this.loading = true;

      const score = Number(this.scoreInput.value);

      if (this.engine.wouldComplete(score)) {
        this.error = "";
        this.pendingFinishScore = score;
        this.scoreInput.clear();
        this.showFinishConfirm = true;
        this.loading = false;
        return;
      }

      try {
        this.engine.record(score);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        this.loading = false;
        return;
      }

      this.error = "";
      this.scoreInput.clear();
      this.$store.game.recordFacts(this.engine.facts());
      this.loading = false;
    },

    async confirmFinish(this: ScoreTrainingPlayContext) {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;
      if (this.pendingFinishScore == null) return;

      const score = this.pendingFinishScore;
      this.pendingFinishScore = null;
      this.showFinishConfirm = false;

      this.engine.record(score);
      this.$store.game.recordFacts(this.engine.facts());

      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },

    cancelFinish(this: ScoreTrainingPlayContext) {
      if (!this.showFinishConfirm || this.pendingFinishScore == null) return;
      this.scoreInput.setValue(String(this.pendingFinishScore));
      this.pendingFinishScore = null;
      this.showFinishConfirm = false;
    },

    undoVisit(this: ScoreTrainingPlayContext) {
      if (this.finished || this.showFinishConfirm) return;
      if (!this.engine || !this.engine.undo()) return;

      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },

    /**
     * Uploads the fact log, then marks the session COMPLETED. On this path
     * only, SESSION_ALREADY_COMPLETED counts as success — it covers "PATCH
     * reached the server, the client never saw the response". Stats are copied
     * into `resultsSnapshot` before any store mutation, so the results modal
     * never depends on `$store.game.turns` surviving a later reset.
     */
    async uploadAndCompleteSession(
      this: ScoreTrainingPlayContext,
    ): Promise<void> {
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

      this.resultsSnapshot = computeStats(this.$store.game.turns);
      this.completionStatus = "succeeded";
    },

    async back(this: ScoreTrainingPlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: ScoreTrainingPlayContext) {
      if (this.abandonLoading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.abandonLoading = true;
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
        this.abandonLoading = false;
      }
    },

    /**
     * Replays the same configuration template the first session used, so the
     * new session's provenance on the server matches rather than drifting to
     * an inline copy. Store and UI are mutated only once the new session
     * exists: on failure the modal stays open with the results visible and the
     * buttons enabled, since the prior session is already COMPLETED.
     */
    async playAgain(this: ScoreTrainingPlayContext) {
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
            config: { source: "template", templateRef },
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
        this.$store.game.idempotencyKey = null;
        this.$store.game.timerRemainingMs = null;
        this.$store.game.timerStartedAt = null;
        this.$store.game.timerExpired = false;

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
        if (!(engine instanceof ScoreTrainingEngine)) return;
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
