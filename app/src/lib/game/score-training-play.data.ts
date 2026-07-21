import { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import { buildEventsBatch } from "@modules/game/score-training.payload.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import type { RecordedTurn } from "@stores/types";
import type { ScoreTrainingPlayContext } from "./types";

function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function computeStats(turns: RecordedTurn[]): {
  total: number;
  visits: number;
  average: number;
} {
  const visits = turns.length;
  const total = turns.reduce((sum, t) => sum + t.totalScore, 0);
  return { total, visits, average: visits === 0 ? 0 : total / visits };
}

export function scoreTrainingPlay() {
  return {
    visitInput: "",

    appendDigit(this: ScoreTrainingPlayContext, digit: number) {
      const next = this.visitInput === "0" ? String(digit) : this.visitInput + String(digit);
      if (next.length > 3) return;
      this.visitInput = next;
    },

    deleteLast(this: ScoreTrainingPlayContext) {
      this.visitInput = this.visitInput.slice(0, -1);
    },

    clearVisitInput(this: ScoreTrainingPlayContext) {
      this.visitInput = "";
    },

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
     * D88 auto-cleanup via shared reconcileActiveSession helper. On "match",
     * resume silently (no Continue/Abandon modal — that is setup-only).
     */
    async init(this: ScoreTrainingPlayContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        const result = await reconcileActiveSession(
          this.$store.game.sessionId,
          activeSessions,
          this.$store.game,
        );

        if (result.action === "abandon_failed") {
          // Block: stay on loading/error, do not flip to "no active session" as if cleaned.
          this.reconciliationFailed = true;
          this.hasActiveSession = false;
          return;
        }
        this.reconciliationFailed = false;

        if (result.action === "no_active") {
          this.hasActiveSession = false;
          return;
        }

        // result.action === "match": resume silently, no modal on play.
        const config = this.$store.game.configSnapshot;
        if (!config) {
          this.hasActiveSession = false;
          return;
        }
        this.engine = new ScoreTrainingEngine({
          durationType: config.durationType,
          durationValue: config.durationValue,
          maxDartsPerTurn: config.maxDartsPerTurn,
          startingSequence: this.$store.game.turns.length,
        });

        if (
          config.durationType === "MINUTES" &&
          !this.$store.game.timerExpired
        ) {
          const resumedRemainingMs = this.$store.game.timerRemainingMs;
          const durationMinutes =
            resumedRemainingMs != null
              ? resumedRemainingMs / 60000
              : config.durationValue;

          // Set synchronously so the countdown label never renders 00:00 while
          // waiting for the timer's first onTick (fires 1s after start()).
          this.$store.game.timerRemainingMs = durationMinutes * 60000;
          if (resumedRemainingMs == null) {
            this.$store.game.timerStartedAt = new Date().toISOString();
          }

          this.timer = new SegmentTimer({
            totalMinutes: durationMinutes,
            intervalMinutes: durationMinutes,
            onTick: (secondsRemaining) => {
              this.$store.game.timerRemainingMs = secondsRemaining * 1000;
            },
            onComplete: () => {
              this.$store.game.timerExpired = true;
            },
          });
          this.timer.start();
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

    async submitVisit(this: ScoreTrainingPlayContext) {
      if (!this.engine || this.finished) return;

      const score = Number(this.visitInput);
      if (!Number.isInteger(score) || score < 0 || score > 180) {
        this.error = "Enter a score between 0 and 180.";
        return;
      }
      this.error = "";
      this.visitInput = "";

      const visit = this.engine.recordVisit(score);
      this.$store.game.recordTurn(visit);

      const timerExpired = this.$store.game.timerExpired ?? false;
      if (!this.engine.isComplete(this.$store.game.turns.length, timerExpired))
        return;

      // Modal appears and completion sequence starts in the same synchronous step.
      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },

    undoVisit(this: ScoreTrainingPlayContext) {
      if (this.finished || this.showFinishConfirm) return;
      if (!this.engine || this.$store.game.turns.length === 0) return;

      this.$store.game.undoLastTurn();
      const poppedLocal = this.engine.undoLastVisit();
      if (!poppedLocal) {
        const config = this.$store.game.configSnapshot;
        if (!config) return;
        this.engine = new ScoreTrainingEngine({
          durationType: config.durationType,
          durationValue: config.durationValue,
          maxDartsPerTurn: config.maxDartsPerTurn,
          startingSequence: this.$store.game.turns.length,
        });
      }

      this.visitInput = "";
      this.error = "";
    },

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
        const completedTurns = this.$store.game.turns.map((turn) => ({
          ...turn,
          completedAt: turn.completedAt ?? new Date().toISOString(),
        }));
        const batch = buildEventsBatch(
          this.$store.game.participantRef!,
          completedTurns,
        );

        await appendBatch(sessionId, idempotencyKey, batch);
        await completeSession(sessionId, "COMPLETED");
      } catch (err: unknown) {
        // On the completion path only: SESSION_ALREADY_COMPLETED counts as success
        // (covers "PATCH OK, client never saw the response").
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

      // Snapshot stats into a component-local field BEFORE any store mutation,
      // so the modal never depends on $store.game.turns surviving a later reset.
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
        const turns = this.$store.game.turns;
        if (turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const completedTurns = turns.map((turn) => ({
            ...turn,
            completedAt: turn.completedAt ?? new Date().toISOString(),
          }));
          const batch = buildEventsBatch(this.$store.game.participantRef!, completedTurns);
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

    async playAgain(this: ScoreTrainingPlayContext) {
      if (!this.$store.game.configSnapshot || this.playAgainLoading) return;
      this.playAgainLoading = true;
      this.playAgainError = "";

      const config = this.$store.game.configSnapshot;
      const inlineConfig = {
        duration_type: config.durationType,
        duration_value: config.durationValue,
        max_darts_per_turn: config.maxDartsPerTurn,
      };

      try {
        let session;
        try {
          session = await createSession({
            gameTypeKey: "SCORE_TRAINING",
            rulesetVersionKey: "SCORE_TRAINING_V1",
            captureModeKey: "RECREATIONAL",
            inputModeKey: "QUICK_SCORE",
            config: { source: "inline", config: inlineConfig },
          });
        } catch {
          // Play-again failure: modal stays open, results visible, buttons stay
          // enabled (prior session is already COMPLETED). Store untouched.
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        // Only mutate store/UI on success.
        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
        this.$store.game.turns = [];
        this.$store.game.idempotencyKey = null;
        this.$store.game.timerRemainingMs = null;
        this.$store.game.timerStartedAt = null;
        this.$store.game.timerExpired = false;

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.visitInput = "";
        this.error = "";
        this.hasActiveSession = true;

        this.engine = new ScoreTrainingEngine({
          durationType: config.durationType,
          durationValue: config.durationValue,
          maxDartsPerTurn: config.maxDartsPerTurn,
          startingSequence: 0,
        });

        if (config.durationType === "MINUTES") {
          this.timer?.stop();
          this.$store.game.timerRemainingMs = config.durationValue * 60000;
          this.$store.game.timerStartedAt = new Date().toISOString();
          this.timer = new SegmentTimer({
            totalMinutes: config.durationValue,
            intervalMinutes: config.durationValue,
            onTick: (secondsRemaining) => {
              this.$store.game.timerRemainingMs = secondsRemaining * 1000;
            },
            onComplete: () => {
              this.$store.game.timerExpired = true;
            },
          });
          this.timer.start();
        }
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
