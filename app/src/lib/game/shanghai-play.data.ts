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
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import { boardInputData } from "@lib/game/board-input.data";
import type { RulesetVersionKey } from "@lib/types";
import type { DartObservation, TurnFact } from "@modules/types";
import type {
  BoardMarker,
  ShanghaiPlayContext,
  ShanghaiPreviewSegment,
} from "./types";
import type { ShanghaiState } from "@modules/types";

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
  let self: ShanghaiPlayContext;

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
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as ShanghaiEngine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    state(this: ShanghaiPlayContext): ShanghaiState | null {
      return this.engine?.state() ?? null;
    },

    currentTargetLabelFor(this: ShanghaiPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(targetNumberAt(seat.targetIndex)) : "";
    },

    currentTargetLabel(this: ShanghaiPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    roundLabelFor(this: ShanghaiPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? `${seat.targetIndex + 1}/20` : "";
    },

    roundLabel(this: ShanghaiPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.roundLabelFor(state.activeParticipantRef);
    },

    currentScoreFor(this: ShanghaiPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.totalScore) : "";
    },

    currentScore(this: ShanghaiPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentScoreFor(state.activeParticipantRef);
    },

    isBullVisit(this: ShanghaiPlayContext): boolean {
      return false;
    },

    previewSegments(this: ShanghaiPlayContext): ShanghaiPreviewSegment[] {
      return previewSegmentsFor(this.$store.game.turns, this.hiddenTurnKey);
    },

    init(this: ShanghaiPlayContext) {
      self = this;
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
      const state = this.state();
      const activeSeat = state?.seats.find(
        (seat) => seat.participantRef === state.activeParticipantRef,
      );
      if (!activeSeat) return;
      const observation: DartObservation =
        ring === "MISS"
          ? {
              hitTargetNumber: null,
              hitZoneKey: "MISS",
              locationX: null,
              locationY: null,
            }
          : {
              hitTargetNumber: targetNumberAt(activeSeat.targetIndex),
              hitZoneKey: ring,
              locationX: null,
              locationY: null,
            };
      await this.commitDart(observation);
    },

    commitDart(this: ShanghaiPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    async recordDart(this: ShanghaiPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /**
     * Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation.
     */
    visitMarkers(this: ShanghaiPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    undoVisit(this: ShanghaiPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: ShanghaiPlayContext): Promise<void> {
      const ownerRef =
        this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )?.participantRef ?? null;
      return playUploadAndCompleteSession(this, (finalState) => {
        const ownerSeat =
          finalState.seats.find((seat) => seat.participantRef === ownerRef) ??
          finalState.seats[0];
        return {
          score: ownerSeat.totalScore,
          status: finalState.status as "SHANGHAI" | "COMPLETE" | "TIE",
          round: ownerSeat.targetIndex + 1,
          winningSideKey: finalState.winningSideKey,
        };
      });
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
