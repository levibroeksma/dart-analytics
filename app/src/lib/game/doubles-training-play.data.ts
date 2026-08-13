import { getEngineFactory } from "@modules/game/engine.registry";
import { resolveSessionModePair } from "@lib/game/session-mode-resolution";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import {
  doublesPathObservation,
  doublesPathPreviewSegments,
  doublesPathTargetLabel,
} from "@lib/game/doubles-path-play";
import type { RulesetVersionKey } from "@lib/types";
import type { DartObservation, EngineFacts } from "@modules/types";
import type {
  DoublesPreviewSegment,
  DoublesTrainingPlayContext,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// doublesTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";

const GAME_TYPE_KEY = "DOUBLES_TRAINING";
const RULESET_VERSION_KEY: RulesetVersionKey = "DOUBLES_TRAINING_V1";

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors
 * `bobs27-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: DoublesTrainingPlayContext["$store"]["game"],
): DoublesTrainingEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof DoublesTrainingEngine ? engine : null;
}

function currentFacts(context: DoublesTrainingPlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

export function doublesTrainingPlay() {
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
    resultsSnapshot: null as { hits: number; misses: number } | null,
    hiddenTurnKey: null as string | null,
    engine: null as DoublesTrainingEngine | null,

    currentTargetLabel(this: DoublesTrainingPlayContext): string {
      if (!this.engine) return "";
      return doublesPathTargetLabel(
        targetAt(doublesPath(), this.engine.state().targetIndex),
      );
    },

    hitCount(this: DoublesTrainingPlayContext): string {
      if (!this.engine) return "0";
      return String(
        this.engine.state().outcomes.filter((outcome) => outcome.hit).length,
      );
    },

    missCount(this: DoublesTrainingPlayContext): string {
      if (!this.engine) return "0";
      return String(
        this.engine.state().outcomes.filter((outcome) => !outcome.hit).length,
      );
    },

    previewSegments(this: DoublesTrainingPlayContext): DoublesPreviewSegment[] {
      return doublesPathPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
      );
    },

    async init(this: DoublesTrainingPlayContext) {
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

        if (engine.isComplete()) {
          this.finished = true;
          this.completionStatus = "pending";
          await this.uploadAndCompleteSession();
        }
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: DoublesTrainingPlayContext) {
      await this.init();
    },

    /** The recreational tap row's entry point: synthesizes the observation
     * for a hit or miss on the current target and funnels it through
     * `commitDart`. */
    async recordTap(this: DoublesTrainingPlayContext, hit: boolean) {
      if (!this.engine || this.finished) return;
      const target = targetAt(doublesPath(), this.engine.state().targetIndex);
      await this.commitDart(doublesPathObservation(target, hit));
    },

    async commitDart(
      this: DoublesTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine) return;
      try {
        this.engine.record(observation);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }
      this.error = "";
      const facts = this.engine.facts();
      this.$store.game.recordFacts(facts);

      const resolvedTurn = facts.turns.at(-1);
      if (resolvedTurn?.completedAt) {
        this.hiddenTurnKey = resolvedTurn.clientKey;
      }

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    undoVisit(this: DoublesTrainingPlayContext) {
      if (this.finished) return;
      if (!this.engine || !this.engine.undo()) return;
      this.hiddenTurnKey = null;
      this.$store.game.recordFacts(this.engine.facts());
      this.error = "";
    },

    async uploadAndCompleteSession(
      this: DoublesTrainingPlayContext,
    ): Promise<void> {
      const sessionId = this.$store.game.sessionId!;

      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      this.completionStatus = "saving";
      this.completionError = "";

      const finalState = this.engine?.state() ?? null;

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

      if (finalState) {
        this.resultsSnapshot = {
          hits: finalState.outcomes.filter((outcome) => outcome.hit).length,
          misses: finalState.outcomes.filter((outcome) => !outcome.hit).length,
        };
      }
      this.completionStatus = "succeeded";
    },

    async back(this: DoublesTrainingPlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: DoublesTrainingPlayContext) {
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
     * Replays the same configuration template the first session used, with
     * no overrides — V1 has zero editable settings.
     */
    async playAgain(this: DoublesTrainingPlayContext) {
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
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
        this.$store.game.idempotencyKey = null;
        this.$store.game.setSessionModes(modePair);

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.hiddenTurnKey = null;
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
        if (!(engine instanceof DoublesTrainingEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
