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
import type { DartFact, DartObservation, TurnFact } from "@modules/types";
import type {
  AroundTheClockPlayContext,
  AroundTheClockPreviewSegment,
  BoardMarker,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// aroundTheClockEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  applyAroundTheClockDart,
  AroundTheClockEngine,
  initialAroundTheClockState,
  isAroundTheClockHit,
} from "@modules/game/around-the-clock.engine.module";

const GAME_TYPE_KEY = "AROUND_THE_CLOCK";
const RULESET_VERSION_KEY: RulesetVersionKey = "AROUND_THE_CLOCK_V1";

const EMPTY_SEGMENTS: readonly AroundTheClockPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

function dartObservation(dart: DartFact): DartObservation {
  return {
    hitTargetNumber: dart.hitTargetNumber,
    hitZoneKey: dart.hitZoneKey,
    locationX: dart.locationX,
    locationY: dart.locationY,
  };
}

/**
 * Replays every dart in fact-log order through the target-progression
 * rules, in step with the engine's own `deriveState`, and records whether
 * each one actually advanced the target. The tap input (`recordTap`)
 * always aims at whichever target is active, so every non-MISS tap is a
 * genuine hit — but a VISUAL_BOARD dart lands wherever the player touched
 * the board, so `hitZoneKey !== "MISS"` alone cannot tell a hit on the
 * active target from a hit on the wrong number.
 */
function replayHits(turns: readonly TurnFact[]): boolean[] {
  let state = initialAroundTheClockState();
  const hits: boolean[] = [];
  for (const turn of turns) {
    for (const dart of turn.darts) {
      const observation = dartObservation(dart);
      const target = targetAt(numbersPath(), state.targetIndex);
      hits.push(isAroundTheClockHit(target, observation));
      state = applyAroundTheClockDart(state, observation);
    }
  }
  return hits;
}

function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): AroundTheClockPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_SEGMENTS];
  }
  const priorDarts = turns
    .slice(0, -1)
    .reduce((total, turn) => total + turn.darts.length, 0);
  const hits = replayHits(turns);
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: hits[priorDarts + i] ? "hit" : "miss" };
  });
}

function countHits(turns: readonly TurnFact[]): number {
  return replayHits(turns).filter(Boolean).length;
}

function countDarts(turns: readonly TurnFact[]): number {
  return turns.reduce((total, turn) => total + turn.darts.length, 0);
}

/** `hits`/`darts` as a percentage, rounded to 2 decimals; "0%" before any dart is thrown. */
function accuracyLabel(hits: number, darts: number): string {
  return darts === 0 ? "0%" : `${((hits / darts) * 100).toFixed(2)}%`;
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

    accuracy(this: AroundTheClockPlayContext): string {
      const turns = this.$store.game.turns;
      return accuracyLabel(countHits(turns), countDarts(turns));
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
        accuracy: accuracyLabel(countHits(turns), countDarts(turns)),
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
