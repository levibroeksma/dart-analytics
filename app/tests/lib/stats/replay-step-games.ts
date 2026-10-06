import { bullUpEngineFactory } from "@modules/training/exercises/bull-up.engine.module";
import { checkoutSequenceEngineFactory } from "@modules/training/exercises/checkout-sequence.engine.module";
import { bullseyeCheckoutEngineFactory } from "@modules/training/exercises/bullseye-checkout.engine.module";
import { doublePatternEngineFactory } from "@modules/training/exercises/double-pattern.engine.module";
import { scoreThresholdEngineFactory } from "@modules/training/exercises/score-threshold.engine.module";
import { switchingTargetScoringEngineFactory } from "@modules/training/exercises/switching-target-scoring.engine.module";
import { switchingEngineFactory } from "@modules/training/exercises/switching.engine.module";
import { targetScoringEngineFactory } from "@modules/training/exercises/target-scoring.engine.module";
import type {
  ExerciseRulesetVersionKey,
  SwitchingConfigData,
} from "@lib/types";
import type { DartExerciseEngineFactory } from "@modules/interfaces";
import type { DartExerciseKind, DartObservation } from "@modules/types";
import type {
  ReplayHeaderSchemaData,
  ReplayTurnSchemaData,
} from "@routes/types";
import { replayHeader } from "./replay-games";

/**
 * A scripted non-game routine step, mirroring `replay-games.ts`'s scripted
 * games (D371 decision 8, phase 6b plan decision 11): a real dart exercise
 * engine plays a few darts, then its own `facts()` become the header and
 * turns the replay route would serve for it, so a test can fold the replay
 * and compare it against the engine that produced it.
 */

const STEP_STAGE_ID = "01900000-0000-7000-9000-000000000201";

/** The session header every scripted step case starts from: a non-game routine step (`gameTypeKey`/`rulesetVersionKey` null, decision 11). */
function stepHeader(
  overrides: Partial<ReplayHeaderSchemaData> = {},
): ReplayHeaderSchemaData {
  return replayHeader({
    gameTypeKey: null,
    rulesetVersionKey: null,
    contextKey: "ROUTINE",
    routineStepSequenceNumber: 1,
    exerciseTypeKey: "SWITCHING",
    exerciseRulesetVersionKey: "SWITCHING_V1",
    routineKey: "name-abc123",
    stepKey: "1-def456",
    participants: [
      {
        participantId: "solo",
        displayName: "Levi",
        participantTypeKey: "PLAYER",
      },
    ],
    stages: [
      {
        stageId: STEP_STAGE_ID,
        parentStageId: null,
        stageTypeKey: "EXERCISE_BLOCK",
        sequence: 1,
      },
    ],
    ...overrides,
  });
}

const SWITCHING_CONFIG: SwitchingConfigData = {
  targets: [20, 19],
  scoring: { single: 1, double: 2, treble: 3 },
};

/**
 * A scripted Switching session: 3 real darts recorded through the actual
 * engine (treble 20, single 19, a miss), so `finalState` is the engine's own
 * ground truth and `header`/`turns` are the wire shape the replay route
 * would have served for the same play.
 */
export function playSwitching() {
  const engine = switchingEngineFactory.create(SWITCHING_CONFIG);
  const observations = [
    {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE" as const,
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: 19,
      hitZoneKey: "SINGLE" as const,
      locationX: null,
      locationY: null,
    },
    {
      hitTargetNumber: null,
      hitZoneKey: "MISS" as const,
      locationX: null,
      locationY: null,
    },
  ];
  observations.forEach((observation) => engine.record(observation));
  const finalState = engine.state();
  const facts = engine.facts();

  const turns: ReplayTurnSchemaData[] = facts.turns.map((turn) => ({
    stageId: STEP_STAGE_ID,
    turnSequence: turn.sequence,
    participantId: turn.participantRef,
    turnTotalScore: turn.totalScore,
    darts: turn.darts.map(({ sequence, ...rest }) => ({
      dartNumber: sequence,
      ...rest,
    })),
  }));

  const header = stepHeader({
    configuration: SWITCHING_CONFIG,
    turnCount: turns.length,
    dartCount: observations.length,
  });

  return { header, turns, finalState };
}

/** One dart, as `routine-summary-engines.module.test.ts` builds it -- board coordinates never matter to a dart exercise engine's own scoring. */
function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

type AnyDartExerciseEngineFactory = DartExerciseEngineFactory<unknown, unknown>;

/**
 * Every `STEP_METRIC_SPECS` kind's own scripted run: the same
 * config/darts pairs `routine-summary-engines.module.test.ts` plays
 * through the real engine (a proven-correct fixture, reused here rather
 * than invented afresh), so a coupling test can drive all eight kinds
 * through the real engine without hand-picking new darts per kind.
 */
const EXERCISE_FIXTURES: Record<
  DartExerciseKind,
  {
    rulesetKey: ExerciseRulesetVersionKey;
    factory: AnyDartExerciseEngineFactory;
    config: Record<string, unknown>;
    darts: DartObservation[];
  }
> = {
  SWITCHING: {
    rulesetKey: "SWITCHING_V1",
    factory: switchingEngineFactory,
    config: {
      targets: [20, 19, 18],
      scoring: { single: 1, double: 2, treble: 3 },
    },
    darts: [
      dart(20, "TREBLE"),
      dart(19, "SINGLE"),
      dart(5, "SINGLE"),
      dart(20, "DOUBLE"),
    ],
  },
  DOUBLE_PATTERN: {
    rulesetKey: "DOUBLE_PATTERN_V1",
    factory: doublePatternEngineFactory,
    config: {
      patterns: [
        [20, 10, 5],
        [16, 8, 4],
      ],
    },
    darts: [
      dart(20, "DOUBLE"),
      dart(10, "SINGLE"),
      dart(5, "DOUBLE"),
      dart(16, "DOUBLE"),
      dart(8, "SINGLE"),
      dart(4, "DOUBLE"),
    ],
  },
  TARGET_SCORING: {
    rulesetKey: "TARGET_SCORING_V1",
    factory: targetScoringEngineFactory,
    config: { targets: [20, 19, 18, 25] },
    darts: [
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(5, "SINGLE"),
      dart(19, "TREBLE"),
      dart(1, "SINGLE"),
    ],
  },
  SWITCHING_TARGET_SCORING: {
    rulesetKey: "SWITCHING_TARGET_SCORING_V1",
    factory: switchingTargetScoringEngineFactory,
    config: { targets: [20, 19, 18] },
    darts: [
      dart(20, "TREBLE"),
      dart(19, "TREBLE"),
      dart(18, "TREBLE"),
      dart(5, "SINGLE"),
      dart(20, "TREBLE"),
    ],
  },
  SCORE_THRESHOLD: {
    rulesetKey: "SCORE_THRESHOLD_V1",
    factory: scoreThresholdEngineFactory,
    config: { threshold: 65 },
    darts: [
      dart(20, "TREBLE"),
      dart(20, "TREBLE"),
      dart(20, "TREBLE"),
      dart(5, "SINGLE"),
      dart(5, "SINGLE"),
      dart(5, "SINGLE"),
      dart(10, "SINGLE"),
    ],
  },
  BULLSEYE_CHECKOUT: {
    rulesetKey: "BULLSEYE_CHECKOUT_V1",
    factory: bullseyeCheckoutEngineFactory,
    config: { startScore: 81 },
    darts: [
      dart(19, "SINGLE"),
      dart(12, "SINGLE"),
      dart(25, "INNER_BULL"),
      dart(20, "TREBLE"),
      dart(5, "SINGLE"),
      dart(25, "INNER_BULL"),
      dart(5, "SINGLE"),
    ],
  },
  BULL_UP: {
    rulesetKey: "BULL_UP_V1",
    factory: bullUpEngineFactory,
    config: {},
    darts: [dart(25, "INNER_BULL"), dart(25, "OUTER_BULL"), dart(5, "SINGLE")],
  },
  CHECKOUT_SEQUENCE: {
    rulesetKey: "CHECKOUT_SEQUENCE_V1",
    factory: checkoutSequenceEngineFactory,
    config: { firstOutshot: 61, lastOutshot: 100, dartLimit: 6 },
    darts: [
      dart(15, "TREBLE"),
      dart(8, "DOUBLE"),
      dart(20, "SINGLE"),
      dart(null, "MISS"),
      dart(null, "MISS"),
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
    ],
  },
};

/**
 * `kind`'s own scripted run, played through its real engine and converted
 * to the wire shape the replay route would have served for it (mirrors
 * `playSwitching`, generalized over all eight `STEP_METRIC_SPECS` kinds).
 */
export function playExerciseKind(kind: DartExerciseKind) {
  const fixture = EXERCISE_FIXTURES[kind];
  const engine = fixture.factory.create(fixture.config);
  fixture.darts.forEach((observation) => engine.record(observation));
  const finalState = engine.state();
  const facts = engine.facts();

  const turns: ReplayTurnSchemaData[] = facts.turns.map((turn) => ({
    stageId: STEP_STAGE_ID,
    turnSequence: turn.sequence,
    participantId: turn.participantRef,
    turnTotalScore: turn.totalScore,
    darts: turn.darts.map(({ sequence, ...rest }) => ({
      dartNumber: sequence,
      ...rest,
    })),
  }));

  const header = stepHeader({
    exerciseTypeKey: kind,
    exerciseRulesetVersionKey: fixture.rulesetKey,
    configuration: fixture.config,
    turnCount: turns.length,
    dartCount: fixture.darts.length,
  });

  return { header, turns, finalState };
}
