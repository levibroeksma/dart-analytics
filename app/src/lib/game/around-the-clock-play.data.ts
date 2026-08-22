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
import type {
  AroundTheClockSnapshot,
  RulesetVersionKey,
  Seated,
} from "@lib/types";
import type {
  AroundTheClockSeatState,
  AroundTheClockState,
  DartFact,
  DartObservation,
  TurnFact,
} from "@modules/types";
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
function replayHits(
  config: Seated<AroundTheClockSnapshot>,
  turns: readonly TurnFact[],
): boolean[] {
  let state = initialAroundTheClockState(config).seats[0];
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
  config: Seated<AroundTheClockSnapshot>,
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
  const hits = replayHits(config, turns);
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: hits[priorDarts + i] ? "hit" : "miss" };
  });
}

function countHits(
  config: Seated<AroundTheClockSnapshot>,
  turns: readonly TurnFact[],
): number {
  return replayHits(config, turns).filter(Boolean).length;
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

    state(this: AroundTheClockPlayContext): AroundTheClockState | null {
      return this.engine?.state() ?? null;
    },

    activeSeatState(
      this: AroundTheClockPlayContext,
    ): AroundTheClockSeatState | null {
      const state = this.state();
      if (!state) return null;
      return (
        state.seats.find(
          (seat) => seat.participantRef === state.activeParticipantRef,
        ) ?? null
      );
    },

    currentTargetLabelFor(
      this: AroundTheClockPlayContext,
      seatRef: string,
    ): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      if (!seat) return "";
      const target = targetAt(numbersPath(), seat.targetIndex);
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },

    currentTargetLabel(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    turnsSoFarFor(this: AroundTheClockPlayContext, seatRef: string): string {
      return String(
        this.$store.game.turns.filter((turn) => turn.participantRef === seatRef)
          .length,
      );
    },

    turnsSoFar(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "0";
      return this.turnsSoFarFor(state.activeParticipantRef);
    },

    accuracyFor(this: AroundTheClockPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot!;
      const turns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === seatRef,
      );
      return accuracyLabel(countHits(config, turns), countDarts(turns));
    },

    accuracy(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "0%";
      return this.accuracyFor(state.activeParticipantRef);
    },

    isBullVisit(this: AroundTheClockPlayContext): boolean {
      const seat = this.activeSeatState();
      if (!seat) return false;
      return targetAt(numbersPath(), seat.targetIndex).kind === "BULL";
    },

    previewSegments(
      this: AroundTheClockPlayContext,
    ): AroundTheClockPreviewSegment[] {
      const state = this.state();
      const config = this.$store.game.configSnapshot;
      if (!state || !config) return [...EMPTY_SEGMENTS];
      const seatTurns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === state.activeParticipantRef,
      );
      return previewSegmentsFor(config, seatTurns, this.hiddenTurnKey);
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
      const seat = this.activeSeatState();
      if (!seat) return;
      const target = targetAt(numbersPath(), seat.targetIndex);
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
      const state = this.state();
      const config = this.$store.game.configSnapshot;
      const ownerRef =
        this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )?.participantRef ?? null;
      const ownerTurns =
        ownerRef === null
          ? this.$store.game.turns
          : this.$store.game.turns.filter(
              (turn) => turn.participantRef === ownerRef,
            );
      return playUploadAndCompleteSession(this, () => ({
        turns: ownerTurns.length,
        accuracy: config
          ? accuracyLabel(countHits(config, ownerTurns), countDarts(ownerTurns))
          : "0%",
        totalDarts: countDarts(ownerTurns),
        winningSideKey: state?.winningSideKey ?? null,
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
