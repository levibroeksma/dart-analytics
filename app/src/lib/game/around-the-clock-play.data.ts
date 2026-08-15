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
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import { boardInputData } from "@lib/game/board-input.data";
import type { RulesetVersionKey } from "@lib/types";
import type { DartObservation, TurnFact } from "@modules/types";
import type {
  AroundTheClockPlayContext,
  AroundTheClockPreviewSegment,
  BoardMarker,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// aroundTheClockEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { AroundTheClockEngine } from "@modules/game/around-the-clock.engine.module";

const GAME_TYPE_KEY = "AROUND_THE_CLOCK";
const RULESET_VERSION_KEY: RulesetVersionKey = "AROUND_THE_CLOCK_V1";

const EMPTY_SEGMENTS: readonly AroundTheClockPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

/**
 * A non-MISS dart is always a hit: this game's tap input always constructs
 * the observation relative to whichever target was active the instant the
 * player tapped (see `recordTap`), so there is no "hit the wrong number"
 * case to detect the way Shanghai's preview does.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): AroundTheClockPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_SEGMENTS];
  }
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: dart.hitZoneKey === "MISS" ? "miss" : "hit" };
  });
}

function countHits(turns: readonly TurnFact[]): number {
  let hits = 0;
  for (const turn of turns) {
    for (const dart of turn.darts) {
      if (dart.hitZoneKey !== "MISS") hits += 1;
    }
  }
  return hits;
}

function countDarts(turns: readonly TurnFact[]): number {
  return turns.reduce((total, turn) => total + turn.darts.length, 0);
}

function resumeEngine(
  game: AroundTheClockPlayContext["$store"]["game"],
): AroundTheClockEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof AroundTheClockEngine ? engine : null;
}

export function aroundTheClockPlay() {
  let self: AroundTheClockPlayContext;

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
    resultsSnapshot: null as AroundTheClockPlayContext["resultsSnapshot"],
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as AroundTheClockEngine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    currentTargetLabel(this: AroundTheClockPlayContext): string {
      if (!this.engine) return "";
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },

    turnsSoFar(this: AroundTheClockPlayContext): string {
      return String(this.$store.game.turns.length);
    },

    isBullVisit(this: AroundTheClockPlayContext): boolean {
      if (!this.engine) return false;
      return (
        targetAt(numbersPath(), this.engine.state().targetIndex).kind === "BULL"
      );
    },

    previewSegments(
      this: AroundTheClockPlayContext,
    ): AroundTheClockPreviewSegment[] {
      return previewSegmentsFor(this.$store.game.turns, this.hiddenTurnKey);
    },

    init(this: AroundTheClockPlayContext) {
      self = this;
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: AroundTheClockPlayContext) {
      return playRetryReconciliation(this);
    },

    async recordTap(
      this: AroundTheClockPlayContext,
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

    commitDart(this: AroundTheClockPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    async recordDart(
      this: AroundTheClockPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /**
     * Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation.
     */
    visitMarkers(this: AroundTheClockPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    undoVisit(this: AroundTheClockPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: AroundTheClockPlayContext): Promise<void> {
      const turns = this.$store.game.turns;
      return playUploadAndCompleteSession(this, () => ({
        turns: turns.length,
        hits: countHits(turns),
        totalDarts: countDarts(turns),
      }));
    },

    back(this: AroundTheClockPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: AroundTheClockPlayContext) {
      return playAbandonAndExit(this);
    },

    playAgain(this: AroundTheClockPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof AroundTheClockEngine ? engine : null,
      );
    },
  };
}
