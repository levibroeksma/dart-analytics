import { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";
import { buildEventsBatch } from "@modules/game/score-training.payload.module";
import { appendBatch, completeSession, fetchActiveSessions } from "@client/api/sessions";
import type { GameConfigSnapshot, RecordedTurn } from "@stores/game.store";

type GameStoreLike = {
  sessionId: string | null;
  participantRef: string | null;
  configSnapshot: GameConfigSnapshot | null;
  turns: RecordedTurn[];
  timerExpired?: boolean;
  recordTurn(turn: RecordedTurn): void;
  reset(): void;
};

export type ScoreTrainingPlayContext = {
  visitInput: string;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  $store: { game: GameStoreLike };
  engine: ScoreTrainingEngine | null;
  init(this: ScoreTrainingPlayContext): Promise<void>;
  submitVisit(this: ScoreTrainingPlayContext): Promise<void>;
};

export function scoreTrainingPlay() {
  return {
    visitInput: "",
    error: "",
    finished: false,
    hasActiveSession: false,
    engine: null as ScoreTrainingEngine | null,

    /**
     * D88 auto-cleanup: reconciles local persisted state against the server's
     * view before trusting either. Local state wins only when both agree on
     * sessionId; any mismatch is resolved without a user prompt.
     */
    async init(this: ScoreTrainingPlayContext) {
      const localSessionId = this.$store.game.sessionId;
      const active = await fetchActiveSessions();
      const matchingActive = active.find((s) => s.gameTypeKey === "SCORE_TRAINING");

      if (localSessionId && (!matchingActive || matchingActive.sessionId !== localSessionId)) {
        this.$store.game.reset();
      } else if (!localSessionId && matchingActive) {
        await completeSession(matchingActive.sessionId, "ABANDONED");
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
      });
      this.hasActiveSession = true;
    },

    async submitVisit(this: ScoreTrainingPlayContext) {
      if (!this.engine) return;

      const score = Number(this.visitInput);
      if (!Number.isInteger(score) || score < 0 || score > 180) {
        this.error = "Enter a score between 0 and 180.";
        return;
      }
      this.error = "";
      this.visitInput = "";

      const visit = this.engine!.recordVisit(score);
      this.$store.game.recordTurn(visit);

      const timerExpired = this.$store.game.timerExpired ?? false;
      if (!this.engine!.isComplete(this.$store.game.turns.length, timerExpired)) return;

      const sessionId = this.$store.game.sessionId!;
      const participantRef = this.$store.game.participantRef!;
      const idempotencyKey = crypto.randomUUID();
      // Store persists completedAt as nullable for durability, but every turn
      // recorded here comes from ScoreTrainingEngine.recordVisit, which always
      // sets an ISO timestamp — so this narrowing is safe at runtime.
      const completedTurns = this.$store.game.turns.map((turn) => ({
        ...turn,
        completedAt: turn.completedAt ?? new Date().toISOString(),
      }));
      const batch = buildEventsBatch(participantRef, completedTurns);
      await appendBatch(sessionId, idempotencyKey, batch);
      await completeSession(sessionId, "COMPLETED");
      this.finished = true;
      this.$store.game.reset();
    },
  };
}
