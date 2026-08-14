import { getEngineFactory } from "@modules/game/engine.registry";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
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
import type { DartObservation, TurnFact } from "@modules/types";
import type { ShanghaiPlayContext, ShanghaiPreviewSegment } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// shanghaiEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { ShanghaiEngine } from "@modules/game/shanghai.engine.module";

const GAME_TYPE_KEY = "SHANGHAI";
const RULESET_VERSION_KEY: RulesetVersionKey = "SHANGHAI_V1";

const EMPTY_SEGMENTS: readonly ShanghaiPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

/**
 * Rounds 1..20 never reach `numbersPath()`'s 21st (BULL) entry — mirrors the
 * same guard the engine itself carries, since this module also needs the
 * plain round number for the tap row and the preview.
 */
function targetNumberAt(targetIndex: number): number {
  const target = targetAt(numbersPath(), targetIndex);
  if (target.kind === "BULL") {
    throw new Error("Shanghai never reaches the BULL target");
  }
  return target.number;
}

/**
 * The last resolved turn maps 1:1 to the round at its own array index (the
 * engine only ever opens a new turn once the previous one holds 3 darts), so
 * its round's number is always `targetNumberAt(turns.length - 1)` — no
 * separate per-dart target bookkeeping is needed.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): ShanghaiPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_SEGMENTS];
  }
  const targetNumber = targetNumberAt(turns.length - 1);
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: dart.hitTargetNumber === targetNumber ? "hit" : "miss" };
  });
}

function resumeEngine(
  game: ShanghaiPlayContext["$store"]["game"],
): ShanghaiEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof ShanghaiEngine ? engine : null;
}

export function shanghaiPlay() {
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
    resultsSnapshot: null as ShanghaiPlayContext["resultsSnapshot"],
    hiddenTurnKey: null as string | null,
    engine: null as ShanghaiEngine | null,

    currentTargetLabel(this: ShanghaiPlayContext): string {
      if (!this.engine) return "";
      return String(targetNumberAt(this.engine.state().targetIndex));
    },

    roundLabel(this: ShanghaiPlayContext): string {
      if (!this.engine) return "";
      return `${this.engine.state().targetIndex + 1}/20`;
    },

    currentScore(this: ShanghaiPlayContext): string {
      if (!this.engine) return "";
      return String(this.engine.state().totalScore);
    },

    isBullVisit(this: ShanghaiPlayContext): boolean {
      return false;
    },

    previewSegments(this: ShanghaiPlayContext): ShanghaiPreviewSegment[] {
      return previewSegmentsFor(this.$store.game.turns, this.hiddenTurnKey);
    },

    init(this: ShanghaiPlayContext) {
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: ShanghaiPlayContext) {
      return playRetryReconciliation(this);
    },

    async recordTap(
      this: ShanghaiPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      if (!this.engine) return;
      const observation: DartObservation =
        ring === "MISS"
          ? {
              hitTargetNumber: null,
              hitZoneKey: "MISS",
              locationX: null,
              locationY: null,
            }
          : {
              hitTargetNumber: targetNumberAt(this.engine.state().targetIndex),
              hitZoneKey: ring,
              locationX: null,
              locationY: null,
            };
      await this.commitDart(observation);
    },

    commitDart(this: ShanghaiPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    undoVisit(this: ShanghaiPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: ShanghaiPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, (finalState) => ({
        score: finalState.totalScore,
        status: finalState.status as "SHANGHAI" | "COMPLETE",
        round: finalState.targetIndex + 1,
      }));
    },

    back(this: ShanghaiPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: ShanghaiPlayContext) {
      return playAbandonAndExit(this);
    },

    playAgain(this: ShanghaiPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof ShanghaiEngine ? engine : null,
      );
    },
  };
}
