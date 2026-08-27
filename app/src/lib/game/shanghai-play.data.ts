import { getEngineFactory } from "@modules/game/engine.registry";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playPreviewSegments,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import { boardInputData } from "@lib/game/board-input.data";
import type { RulesetVersionKey } from "@lib/types";
import type {
  DartObservation,
  ShanghaiSeatState,
  ShanghaiState,
  TurnFact,
} from "@modules/types";
import type {
  BoardMarker,
  ShanghaiPlayContext,
  ShanghaiPreviewSegment,
  ShanghaiSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// shanghaiEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  ShanghaiEngine,
  zoneBucketOf,
} from "@modules/game/shanghai.engine.module";

const GAME_TYPE_KEY = "SHANGHAI";
const RULESET_VERSION_KEY: RulesetVersionKey = "SHANGHAI_V1";

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
 * The last resolved turn maps 1:1 to the round at its own array index within
 * that turn's own seat's history — never `turns.length - 1`, which counts
 * every seat's turns together and is wrong the moment a 1v1 session's turns
 * interleave (issue #166). `seatRoundIndex` is computed once from a count of
 * `turns` filtered to the last turn's own `participantRef`, so a solo
 * session (where every turn already belongs to the one seat) computes the
 * exact same value `turns.length - 1` always gave it — no behavior change
 * there.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): ShanghaiPreviewSegment[] {
  const lastTurn = turns.at(-1);
  const seatRoundIndex = lastTurn
    ? turns.filter((turn) => turn.participantRef === lastTurn.participantRef)
        .length - 1
    : 0;
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const targetNumber = targetNumberAt(seatRoundIndex);
    return dart.hitTargetNumber === targetNumber ? "hit" : "miss";
  });
}

/**
 * One seat's own results stats, replayed from its own darts in `turns` — a
 * seat's `targetIndex`/`totalScore` (from `finalState`) name where it ended
 * and its final score, but not its per-dart accuracy or zone breakdown,
 * which need each dart's own round at the time it was thrown. Every one of
 * a seat's own turns holds exactly 3 darts by the time a session is fully
 * complete (Shanghai has no early-visit-end rule), so grouping the seat's
 * flattened darts into 3s in throw order reproduces its round-by-round
 * history exactly.
 */
function statsFor(
  seat: ShanghaiSeatState,
  turns: readonly TurnFact[],
): ShanghaiSeatResult {
  const seatDarts = turns
    .filter((turn) => turn.participantRef === seat.participantRef)
    .flatMap((turn) => turn.darts);

  let hits = 0;
  let trebles = 0;
  let doubles = 0;
  let singles = 0;
  seatDarts.forEach((dart, index) => {
    const targetNumber = targetNumberAt(Math.floor(index / 3));
    if (dart.hitTargetNumber === targetNumber) hits += 1;
    const bucket = zoneBucketOf(dart.hitZoneKey);
    if (bucket === "TREBLE") trebles += 1;
    if (bucket === "DOUBLE") doubles += 1;
    if (bucket === "SINGLE") singles += 1;
  });

  const accuracy =
    seatDarts.length === 0
      ? "0%"
      : `${Math.round((hits / seatDarts.length) * 100)}%`;

  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    score: seat.totalScore,
    round: seat.targetIndex + 1,
    accuracy,
    trebles,
    doubles,
    singles,
  };
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
      const turns = this.$store.game.turns;
      return playUploadAndCompleteSession(this, (finalState) => ({
        status: finalState.status as "SHANGHAI" | "COMPLETE" | "TIE",
        winningSideKey: finalState.winningSideKey,
        seats: finalState.seats.map((seat) => statsFor(seat, turns)),
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
