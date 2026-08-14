import { getEngineFactory } from "@modules/game/engine.registry";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import {
  doublesPathObservation,
  doublesPathPreviewSegments,
  doublesPathTargetLabel,
} from "@lib/game/doubles-path-play";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import type { RulesetVersionKey } from "@lib/types";
import type { DartObservation } from "@modules/types";
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

    init(this: DoublesTrainingPlayContext) {
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: DoublesTrainingPlayContext) {
      return playRetryReconciliation(this);
    },

    /** The recreational tap row's entry point: synthesizes the observation
     * for a hit or miss on the current target and funnels it through
     * `commitDart`. */
    async recordTap(this: DoublesTrainingPlayContext, hit: boolean) {
      if (!this.engine || this.finished) return;
      const target = targetAt(doublesPath(), this.engine.state().targetIndex);
      await this.commitDart(doublesPathObservation(target, hit));
    },

    commitDart(this: DoublesTrainingPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    undoVisit(this: DoublesTrainingPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: DoublesTrainingPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, (finalState) => ({
        hits: finalState.outcomes.filter((outcome) => outcome.hit).length,
        misses: finalState.outcomes.filter((outcome) => !outcome.hit).length,
      }));
    },

    back(this: DoublesTrainingPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: DoublesTrainingPlayContext) {
      return playAbandonAndExit(this);
    },

    playAgain(this: DoublesTrainingPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof DoublesTrainingEngine ? engine : null,
      );
    },
  };
}
