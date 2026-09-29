import { switchingEngineFactory } from "@modules/training/exercises/switching.engine.module";
import type { SwitchingConfigData } from "@lib/types";
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
