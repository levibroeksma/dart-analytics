import { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import { buildEventsBatch } from "@modules/game/score-training.payload.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { appendBatch, completeSession, fetchActiveSessions } from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import type { RecordedTurn } from "@stores/types";
import type { ScoreTrainingPlayContext } from "./types";

type GameStoreLike = ScoreTrainingPlayContext["$store"]["game"];

function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildResultsUrl(turns: RecordedTurn[]): string {
  const visits = turns.length;
  const total = turns.reduce((sum, t) => sum + t.totalScore, 0);
  const average = visits === 0 ? 0 : total / visits;
  const params = new URLSearchParams({
    total: String(total),
    average: String(average),
    visits: String(visits),
  });
  return `/games/score-training/results?${params.toString()}`;
}

async function uploadCompletion(store: GameStoreLike, sessionId: string, idempotencyKey: string): Promise<void> {
  // Store persists completedAt as nullable for durability, but every turn
  // recorded here comes from ScoreTrainingEngine.recordVisit, which always
  // sets an ISO timestamp — so this narrowing is safe at runtime.
  const completedTurns = store.turns.map((turn) => ({
    ...turn,
    completedAt: turn.completedAt ?? new Date().toISOString(),
  }));
  const batch = buildEventsBatch(store.participantRef!, completedTurns);
  await appendBatch(sessionId, idempotencyKey, batch);
  await completeSession(sessionId, "COMPLETED");
}

export function scoreTrainingPlay() {
  return {
    visitInput: "",
    error: "",
    completionFailed: false,
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
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
      const activeSessions = await fetchActiveSessions();
      const result = await reconcileActiveSession(
        this.$store.game.sessionId,
        activeSessions,
        this.$store.game,
      );
      this.loadingReconciliation = false;

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

      if (config.durationType === "MINUTES" && !this.$store.game.timerExpired) {
        const resumedRemainingMs = this.$store.game.timerRemainingMs;
        const durationMinutes =
          resumedRemainingMs != null ? resumedRemainingMs / 60000 : config.durationValue;

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
    },

    async retryReconciliation(this: ScoreTrainingPlayContext) {
      await this.init();
    },

    destroy(this: ScoreTrainingPlayContext) {
      this.timer?.stop();
    },

    async submitVisit(this: ScoreTrainingPlayContext) {
      if (!this.engine) return;
      if (this.completionFailed) return;

      const score = Number(this.visitInput);
      if (!Number.isInteger(score) || score < 0 || score > 180) {
        this.error = "Enter a score between 0 and 180.";
        this.completionFailed = false;
        return;
      }
      this.error = "";
      this.completionFailed = false;
      this.visitInput = "";

      const visit = this.engine.recordVisit(score);
      this.$store.game.recordTurn(visit);

      const timerExpired = this.$store.game.timerExpired ?? false;
      if (!this.engine.isComplete(this.$store.game.turns.length, timerExpired)) return;

      await this.retryCompletion();
    },

    async retryCompletion(this: ScoreTrainingPlayContext) {
      const sessionId = this.$store.game.sessionId!;
      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      try {
        await uploadCompletion(this.$store.game, sessionId, idempotencyKey);
      } catch {
        this.error = "Could not complete the session. Check your connection and retry.";
        this.completionFailed = true;
        return;
      }

      // Compute the results-page URL from turns still in the store — the store
      // is reset immediately after, so results/index.astro cannot read these
      // stats back out of Alpine state and must receive them via query params.
      const resultsUrl = buildResultsUrl(this.$store.game.turns);
      this.finished = true;
      this.error = "";
      this.completionFailed = false;
      this.$store.game.reset();
      if (globalThis.location) {
        globalThis.location.href = resultsUrl;
      }
    },
  };
}
