import { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import { buildEventsBatch } from "@modules/game/score-training.payload.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { appendBatch, completeSession, fetchActiveSessions } from "@client/api/sessions";
import type { GameConfigSnapshot, RecordedTurn } from "@stores/game.store";

type GameStoreLike = {
  sessionId: string | null;
  participantRef: string | null;
  configSnapshot: GameConfigSnapshot | null;
  turns: RecordedTurn[];
  timerRemainingMs?: number | null;
  timerExpired?: boolean;
  idempotencyKey?: string | null;
  recordTurn(turn: RecordedTurn): void;
  reset(): void;
};

export type ScoreTrainingPlayContext = {
  visitInput: string;
  error: string;
  completionFailed: boolean;
  finished: boolean;
  hasActiveSession: boolean;
  $store: { game: GameStoreLike };
  engine: ScoreTrainingEngine | null;
  timer: SegmentTimer | null;
  remainingLabel(this: ScoreTrainingPlayContext): string;
  init(this: ScoreTrainingPlayContext): Promise<void>;
  submitVisit(this: ScoreTrainingPlayContext): Promise<void>;
  retryCompletion(this: ScoreTrainingPlayContext): Promise<void>;
  destroy(this: ScoreTrainingPlayContext): void;
};

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
    engine: null as ScoreTrainingEngine | null,
    timer: null as SegmentTimer | null,

    remainingLabel(this: ScoreTrainingPlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    /**
     * D88 auto-cleanup: reconciles local persisted state against the server's
     * view before trusting either. Local state wins only when both agree on
     * sessionId; any mismatch is resolved without a user prompt.
     */
    async init(this: ScoreTrainingPlayContext) {
      const localSessionId = this.$store.game.sessionId;
      const active = await fetchActiveSessions();

      if (localSessionId) {
        const localMatch = active.find(
          (s) => s.gameTypeKey === "SCORE_TRAINING" && s.sessionId === localSessionId,
        );
        if (!localMatch) {
          this.$store.game.reset();
        }
      } else {
        const orphan = active.find((s) => s.gameTypeKey === "SCORE_TRAINING");
        if (orphan) {
          await completeSession(orphan.sessionId, "ABANDONED");
        }
      }

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

      if (config.durationType === "MINUTES") {
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

      this.hasActiveSession = true;
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
