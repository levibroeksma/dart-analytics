import { getEngineFactory } from "@modules/game/engine.registry";
import {
  BULL_TARGET_NUMBER,
  numbersPath,
  targetAt,
} from "@modules/game/board-progression.module";
import { boardInputData } from "@lib/game/board-input.data";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
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
import { targetOrderFor } from "@lib/game/target-order";
import type { RulesetVersionKey, SinglesSnapshot } from "@lib/types";
import type {
  BoardTarget,
  DartFact,
  DartObservation,
  DartZoneKey,
  SinglesTrainingState,
  TurnFact,
} from "@modules/types";
import type {
  BoardMarker,
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
 * The dart one recreational tap stands for, on `target`. A MISS carries no
 * target number at all; a tap on the BULL target resolves SINGLE to the outer
 * bull and DOUBLE to the inner one; every other target takes the tapped ring
 * as-is. Coordinates are always null — a tap says which ring was hit, never
 * where on the board it landed.
 */
function tapObservation(
  target: BoardTarget,
  ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
): DartObservation {
  if (ring === "MISS") {
    return {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };
  }
  if (target.kind === "BULL") {
    return {
      hitTargetNumber: BULL_TARGET_NUMBER,
      hitZoneKey: ring === "SINGLE" ? "OUTER_BULL" : "INNER_BULL",
      locationX: null,
      locationY: null,
    };
  }
  return {
    hitTargetNumber: target.number,
    hitZoneKey: ring,
    locationX: null,
    locationY: null,
  };
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
  if (!config) return [...EMPTY_SEGMENTS];
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const target = targetAt(numbersPath(config.targetOrder), turns.length - 1);
    return trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss";
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
  let self: SinglesTrainingPlayContext;

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
    resultsSnapshot: null as {
      points: number;
      misses: number;
      singles: number;
      doubles: number;
      trebles: number;
      hitPercentage: string;
      winningSideKey: string | null;
      status: "COMPLETE" | "TIE";
    } | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as SinglesTrainingEngine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    state(this: SinglesTrainingPlayContext): SinglesTrainingState | null {
      return this.engine?.state() ?? null;
    },

    currentTargetLabelFor(
      this: SinglesTrainingPlayContext,
      seatRef: string,
    ): string {
      const config = this.$store.game.configSnapshot;
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      if (!config || !seat) return "";
      const target = targetAt(
        numbersPath(config.targetOrder),
        seat.targetIndex,
      );
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },

    currentTargetLabel(this: SinglesTrainingPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    currentPointsFor(
      this: SinglesTrainingPlayContext,
      seatRef: string,
    ): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.totalPoints) : "";
    },

    currentPoints(this: SinglesTrainingPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentPointsFor(state.activeParticipantRef);
    },

    isBullVisit(this: SinglesTrainingPlayContext): boolean {
      const config = this.$store.game.configSnapshot;
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!config || !seat) return false;
      return (
        targetAt(numbersPath(config.targetOrder), seat.targetIndex).kind ===
        "BULL"
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

    missCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      return String(
        countZoneKey(
          this.$store.game.turns.filter((t) => t.participantRef === seatRef),
          MISS_COUNT_ZONE_KEYS,
        ),
      );
    },
    missCount(this: SinglesTrainingPlayContext): string {
      return String(countZoneKey(this.$store.game.turns, MISS_COUNT_ZONE_KEYS));
    },

    singleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      return String(
        countZoneKey(
          this.$store.game.turns.filter((t) => t.participantRef === seatRef),
          SINGLE_COUNT_ZONE_KEYS,
        ),
      );
    },
    singleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, SINGLE_COUNT_ZONE_KEYS),
      );
    },

    doubleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      return String(
        countZoneKey(
          this.$store.game.turns.filter((t) => t.participantRef === seatRef),
          DOUBLE_COUNT_ZONE_KEYS,
        ),
      );
    },
    doubleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, DOUBLE_COUNT_ZONE_KEYS),
      );
    },

    trebleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      return String(
        countZoneKey(
          this.$store.game.turns.filter((t) => t.participantRef === seatRef),
          TREBLE_COUNT_ZONE_KEYS,
        ),
      );
    },
    trebleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, TREBLE_COUNT_ZONE_KEYS),
      );
    },

    init(this: SinglesTrainingPlayContext) {
      self = this;
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: SinglesTrainingPlayContext) {
      return playRetryReconciliation(this);
    },

    async recordTap(
      this: SinglesTrainingPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      const config = this.$store.game.configSnapshot;
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!this.engine || !config || !seat || this.finished) return;
      const target = targetAt(
        numbersPath(config.targetOrder),
        seat.targetIndex,
      );
      if (target.kind === "BULL" && ring === "TREBLE") return;
      await this.commitDart(tapObservation(target, ring));
    },

    commitDart(this: SinglesTrainingPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    async recordDart(
      this: SinglesTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: SinglesTrainingPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    undoVisit(this: SinglesTrainingPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: SinglesTrainingPlayContext): Promise<void> {
      const ownerRef =
        this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )?.participantRef ?? null;
      return playUploadAndCompleteSession(this, (finalState) => {
        const ownerSeat =
          finalState.seats.find((seat) => seat.participantRef === ownerRef) ??
          finalState.seats[0];
        const turns = this.$store.game.turns.filter(
          (t) => t.participantRef === ownerSeat.participantRef,
        );
        const misses = countZoneKey(turns, MISS_COUNT_ZONE_KEYS);
        const singles = countZoneKey(turns, SINGLE_COUNT_ZONE_KEYS);
        const doubles = countZoneKey(turns, DOUBLE_COUNT_ZONE_KEYS);
        const trebles = countZoneKey(turns, TREBLE_COUNT_ZONE_KEYS);
        const hits = singles + doubles + trebles;
        const darts = hits + misses;
        return {
          points: ownerSeat.totalPoints,
          misses,
          singles,
          doubles,
          trebles,
          hitPercentage: accuracyDisplay(hits, darts),
          winningSideKey: finalState.winningSideKey,
          status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
        };
      });
    },

    back(this: SinglesTrainingPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: SinglesTrainingPlayContext) {
      return playAbandonAndExit(this);
    },

    playAgain(this: SinglesTrainingPlayContext) {
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof SinglesTrainingEngine ? engine : null),
        (priorConfig) => {
          const targetOrder = targetOrderFor(priorConfig.orderMode);
          return {
            snapshot: { ...priorConfig, targetOrder },
            wire: {
              order_mode: priorConfig.orderMode,
              target_order: targetOrder,
            },
          };
        },
      );
    },
  };
}
