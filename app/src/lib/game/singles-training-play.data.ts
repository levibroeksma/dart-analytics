import { getEngineFactory } from "@modules/game/engine.registry";
import { singlesTrainingResultsTitle } from "@lib/game/match-result-text";
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
import type {
  RulesetVersionKey,
  SinglesSnapshot,
  SinglesV2Snapshot,
} from "@lib/types";
import type {
  BoardTarget,
  DartFact,
  DartObservation,
  DartZoneKey,
  SinglesTrainingSeatState,
  SinglesTrainingState,
  TurnFact,
} from "@modules/types";
import type {
  BoardMarker,
  SinglesPreviewSegment,
  SinglesTrainingPlayContext,
  SinglesTrainingResultsSnapshot,
  SinglesTrainingSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// singlesTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";

const GAME_TYPE_KEY = "SINGLES_TRAINING";
const RESUMABLE_RULESET_VERSIONS = new Set<RulesetVersionKey>([
  "SINGLES_V1",
  "SINGLES_V2",
]);

type SinglesConfigSnapshot = SinglesSnapshot | SinglesV2Snapshot;

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

type TargetHitCategory = "SINGLE" | "DOUBLE" | "TREBLE";

/**
 * Which ring `dart` hit on `target`, or `null` when it landed on a different
 * number, a bounce-out/outer-ring zone, or missed the board entirely — the
 * same "on target" rule `trainingPointsFor` scores by, but independent of
 * configured point values so a 0-point ring still counts as a hit.
 */
function targetHitCategory(
  target: BoardTarget,
  dart: DartFact,
): TargetHitCategory | null {
  if (target.kind === "BULL") {
    if (dart.hitTargetNumber !== BULL_TARGET_NUMBER) return null;
    if (dart.hitZoneKey === "OUTER_BULL") return "SINGLE";
    if (dart.hitZoneKey === "INNER_BULL") return "DOUBLE";
    return null;
  }
  if (dart.hitTargetNumber !== target.number) return null;
  if (SINGLE_ZONE_KEYS.has(dart.hitZoneKey)) return "SINGLE";
  if (dart.hitZoneKey === "DOUBLE") return "DOUBLE";
  if (dart.hitZoneKey === "TREBLE") return "TREBLE";
  return null;
}

/**
 * Per-ring on-target hit counts across `turns`, plus `misses` for every dart
 * that did not hit its own turn's target — a bounce-out, an outer-ring hit,
 * or a different number all count as a miss here, never toward a ring they
 * didn't actually complete. Assumes each turn maps 1:1 to the target at its
 * own array index (see `previewSegmentsFor`).
 */
function targetHitCounts(
  turns: readonly TurnFact[],
  config: SinglesConfigSnapshot,
): { singles: number; doubles: number; trebles: number; misses: number } {
  let singles = 0;
  let doubles = 0;
  let trebles = 0;
  let misses = 0;
  turns.forEach((turn, index) => {
    const target = targetAt(numbersPath(config.targetOrder), index);
    for (const dart of turn.darts) {
      const category = targetHitCategory(target, dart);
      if (category === "SINGLE") singles += 1;
      else if (category === "DOUBLE") doubles += 1;
      else if (category === "TREBLE") trebles += 1;
      else misses += 1;
    }
  });
  return { singles, doubles, trebles, misses };
}

function trainingPointsFor(
  target: BoardTarget,
  config: SinglesConfigSnapshot,
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
  config: SinglesConfigSnapshot | null,
  hiddenTurnKey: string | null,
): SinglesPreviewSegment[] {
  if (!config) return [...EMPTY_SEGMENTS];
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const target = targetAt(numbersPath(config.targetOrder), turns.length - 1);
    return trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss";
  });
}

/**
 * A seat's own outcome label for the results screen. `LOST` covers both a
 * solo HARD/EXTREME failure and the failing seat itself in 1v1; `WON` is
 * the surviving seat when elimination (not score-compare) decided the
 * match. Both are new terminal outcomes alongside the existing
 * score-compare-only `COMPLETE`/`TIE`.
 */
function statusFor(
  finalState: SinglesTrainingState,
  seat: SinglesTrainingSeatState,
): "COMPLETE" | "TIE" | "WON" | "LOST" {
  if (seat.status === "LOST") return "LOST";
  if (finalState.seats.some((candidate) => candidate.status === "LOST"))
    return "WON";
  return finalState.status === "TIE" ? "TIE" : "COMPLETE";
}

function statsFor(
  seat: SinglesTrainingSeatState,
  finalState: SinglesTrainingState,
  turns: readonly TurnFact[],
  config: SinglesConfigSnapshot | null,
): SinglesTrainingSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const { singles, doubles, trebles, misses } = config
    ? targetHitCounts(seatTurns, config)
    : { singles: 0, doubles: 0, trebles: 0, misses: 0 };
  const hits = singles + doubles + trebles;
  const darts = hits + misses;
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    points: seat.totalPoints,
    misses,
    singles,
    doubles,
    trebles,
    accuracy: accuracyDisplay(hits, darts),
    status: statusFor(finalState, seat),
  };
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Accepts either ruleset version
 * — both build the same `SinglesTrainingEngine` class (Pattern 18) — since
 * `/games/singles-training/play` is shared between them.
 */
function resumeEngine(
  game: SinglesTrainingPlayContext["$store"]["game"],
): SinglesTrainingEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (
    !configSnapshot ||
    !rulesetVersionKey ||
    !RESUMABLE_RULESET_VERSIONS.has(rulesetVersionKey)
  )
    return null;
  const factory = getEngineFactory(rulesetVersionKey);
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
    resultsSnapshot: null as SinglesTrainingResultsSnapshot | null,
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
      const config = this.$store.game.configSnapshot;
      if (!config) return "0";
      return String(
        targetHitCounts(
          this.$store.game.turns.filter((t) => t.participantRef === seatRef),
          config,
        ).misses,
      );
    },
    missCount(this: SinglesTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "0";
      return String(targetHitCounts(this.$store.game.turns, config).misses);
    },

    singleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "0";
      return String(
        targetHitCounts(
          this.$store.game.turns.filter((t) => t.participantRef === seatRef),
          config,
        ).singles,
      );
    },
    singleCount(this: SinglesTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "0";
      return String(targetHitCounts(this.$store.game.turns, config).singles);
    },

    doubleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "0";
      return String(
        targetHitCounts(
          this.$store.game.turns.filter((t) => t.participantRef === seatRef),
          config,
        ).doubles,
      );
    },
    doubleCount(this: SinglesTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "0";
      return String(targetHitCounts(this.$store.game.turns, config).doubles);
    },

    trebleCountFor(this: SinglesTrainingPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "0";
      return String(
        targetHitCounts(
          this.$store.game.turns.filter((t) => t.participantRef === seatRef),
          config,
        ).trebles,
      );
    },
    trebleCount(this: SinglesTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "0";
      return String(targetHitCounts(this.$store.game.turns, config).trebles);
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
      const config = this.$store.game.configSnapshot;
      return playUploadAndCompleteSession(this, (finalState) => ({
        winningSideKey: finalState.winningSideKey,
        seats: finalState.seats.map((seat) =>
          statsFor(seat, finalState, this.$store.game.turns, config),
        ),
      }));
    },

    resultsTitle(this: SinglesTrainingPlayContext): string {
      return singlesTrainingResultsTitle(
        this.$store.game.seats,
        this.resultsSnapshot,
      );
    },

    back(this: SinglesTrainingPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: SinglesTrainingPlayContext) {
      return playAbandonAndExit(this);
    },

    playAgain(this: SinglesTrainingPlayContext) {
      const rulesetVersionKey = this.$store.game.rulesetVersionKey;
      if (
        !rulesetVersionKey ||
        !RESUMABLE_RULESET_VERSIONS.has(rulesetVersionKey)
      )
        return;
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        rulesetVersionKey,
        (engine) => (engine instanceof SinglesTrainingEngine ? engine : null),
        (priorConfig) => {
          const targetOrder = targetOrderFor(priorConfig.orderMode);
          return {
            snapshot: { ...priorConfig, targetOrder },
            wire: {
              order_mode: priorConfig.orderMode,
              target_order: targetOrder,
              difficulty: priorConfig.difficulty,
            },
          };
        },
      );
    },
  };
}
