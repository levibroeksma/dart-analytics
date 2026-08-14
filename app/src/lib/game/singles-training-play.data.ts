import { getEngineFactory } from "@modules/game/engine.registry";
import {
  BULL_TARGET_NUMBER,
  numbersPath,
  targetAt,
} from "@modules/game/board-progression.module";
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
import type { RulesetVersionKey, SinglesSnapshot } from "@lib/types";
import type {
  BoardTarget,
  DartFact,
  DartObservation,
  DartZoneKey,
  TurnFact,
} from "@modules/types";
import type {
  SinglesPreviewSegment,
  SinglesTrainingPlayContext,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// singlesTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";

const GAME_TYPE_KEY = "SINGLES_TRAINING";
const RULESET_VERSION_KEY: RulesetVersionKey = "SINGLES_V1";

const EMPTY_SEGMENTS: readonly SinglesPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

/** Mirrors the engine's own (unexported) ring classification — the module
 * boundary between this play data module and the engine module means it
 * cannot be imported directly; see the design spec's flagged duplication. */
const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
]);

const MISS_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set(["MISS"]);
const SINGLE_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "OUTER_BULL",
]);
const DOUBLE_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "DOUBLE",
  "INNER_BULL",
]);
const TREBLE_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set(["TREBLE"]);

function countZoneKey(
  turns: readonly TurnFact[],
  zoneKeys: ReadonlySet<DartZoneKey>,
): number {
  let count = 0;
  for (const turn of turns) {
    for (const dart of turn.darts) {
      if (zoneKeys.has(dart.hitZoneKey)) count += 1;
    }
  }
  return count;
}

function trainingPointsFor(
  target: BoardTarget,
  config: SinglesSnapshot,
  dart: DartFact,
): number {
  if (target.kind === "BULL") {
    if (dart.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    if (dart.hitZoneKey === "OUTER_BULL") return config.pointsSingle;
    if (dart.hitZoneKey === "INNER_BULL") return config.pointsDouble;
    return 0;
  }
  if (dart.hitTargetNumber !== target.number) return 0;
  if (SINGLE_ZONE_KEYS.has(dart.hitZoneKey)) return config.pointsSingle;
  if (dart.hitZoneKey === "DOUBLE") return config.pointsDouble;
  if (dart.hitZoneKey === "TREBLE") return config.pointsTreble;
  return 0;
}

/**
 * Every turn maps 1:1 to the target at its own array index (the engine only
 * ever opens a new turn once the previous one holds 3 darts), so the last
 * turn's target is always `targetAt(numbersPath(), turns.length - 1)` — no
 * separate per-dart target bookkeeping is needed.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  config: SinglesSnapshot | null,
  hiddenTurnKey: string | null,
): SinglesPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey || !config) {
    return [...EMPTY_SEGMENTS];
  }
  const target = targetAt(numbersPath(), turns.length - 1);
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return {
      status: trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss",
    };
  });
}

function resumeEngine(
  game: SinglesTrainingPlayContext["$store"]["game"],
): SinglesTrainingEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof SinglesTrainingEngine ? engine : null;
}

export function singlesTrainingPlay() {
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
    resultsSnapshot: null as { points: number } | null,
    hiddenTurnKey: null as string | null,
    engine: null as SinglesTrainingEngine | null,

    currentTargetLabel(this: SinglesTrainingPlayContext): string {
      if (!this.engine) return "";
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },

    currentPoints(this: SinglesTrainingPlayContext): string {
      if (!this.engine) return "";
      return String(this.engine.state().totalPoints);
    },

    isBullVisit(this: SinglesTrainingPlayContext): boolean {
      if (!this.engine) return false;
      return (
        targetAt(numbersPath(), this.engine.state().targetIndex).kind === "BULL"
      );
    },

    previewSegments(this: SinglesTrainingPlayContext): SinglesPreviewSegment[] {
      if (!this.engine) return [...EMPTY_SEGMENTS];
      return previewSegmentsFor(
        this.$store.game.turns,
        this.$store.game.configSnapshot,
        this.hiddenTurnKey,
      );
    },

    missCount(this: SinglesTrainingPlayContext): string {
      return String(countZoneKey(this.$store.game.turns, MISS_COUNT_ZONE_KEYS));
    },

    singleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, SINGLE_COUNT_ZONE_KEYS),
      );
    },

    doubleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, DOUBLE_COUNT_ZONE_KEYS),
      );
    },

    trebleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, TREBLE_COUNT_ZONE_KEYS),
      );
    },

    init(this: SinglesTrainingPlayContext) {
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: SinglesTrainingPlayContext) {
      return playRetryReconciliation(this);
    },

    async recordTap(
      this: SinglesTrainingPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      if (!this.engine || this.finished) return;
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
      if (target.kind === "BULL" && ring === "TREBLE") return;
      const observation: DartObservation =
        ring === "MISS"
          ? {
              hitTargetNumber: null,
              hitZoneKey: "MISS",
              locationX: null,
              locationY: null,
            }
          : target.kind === "BULL"
            ? {
                hitTargetNumber: BULL_TARGET_NUMBER,
                hitZoneKey: ring === "SINGLE" ? "OUTER_BULL" : "INNER_BULL",
                locationX: null,
                locationY: null,
              }
            : {
                hitTargetNumber: target.number,
                hitZoneKey: ring,
                locationX: null,
                locationY: null,
              };
      await this.commitDart(observation);
    },

    commitDart(this: SinglesTrainingPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    undoVisit(this: SinglesTrainingPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: SinglesTrainingPlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, (finalState) => ({
        points: finalState.totalPoints,
      }));
    },

    back(this: SinglesTrainingPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: SinglesTrainingPlayContext) {
      return playAbandonAndExit(this);
    },

    playAgain(this: SinglesTrainingPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof SinglesTrainingEngine ? engine : null,
      );
    },
  };
}
