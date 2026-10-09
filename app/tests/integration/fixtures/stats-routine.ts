import { sql } from "drizzle-orm";
import {
  insertSession,
  UNIVERSAL_SCRIPT,
  uuid,
  type DartScript,
  type Db,
} from "./stats-world-sql";

const ROUTINE_ACTIVITY_ID = uuid(0xa2000);
const ROUTINE_CONFIG_ID = uuid(0xa2001);
/** Doubles as `routine_key` in `v_stats_routine_run_facts` (spec F7). */
export const ROUTINE_TEMPLATE_ID = uuid(0xa20f1);
const ROUTINE_NAME = "Stats World Routine";
const STEP_DURATION_SECONDS = 300;

/** One element of `activity_configurations.configuration.steps` — exactly the keys the app writes (spec F8). */
export type RoutineStep = {
  sequenceNumber: number;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  gameRulesetVersionKey: string | null;
  durationSeconds: number;
  configuration: Record<string, unknown>;
};

function exerciseStep(
  sequenceNumber: number,
  kind: string,
  configuration: Record<string, unknown>,
): RoutineStep {
  return {
    sequenceNumber,
    exerciseTypeKey: kind,
    exerciseRulesetVersionKey: `${kind}_V1`,
    gameTypeKey: null,
    gameRulesetVersionKey: null,
    durationSeconds: STEP_DURATION_SECONDS,
    configuration,
  };
}

/**
 * Spec §4.4: Warm-Up, the nine dart kinds (every `STEP_METRIC_SPECS` key),
 * then a 501 game step whose configuration is filled in by `seedRoutineRun`.
 * Configs are the camelCase V1 shapes, literals included (spec F13).
 */
export const ROUTINE_STEPS: readonly RoutineStep[] = [
  exerciseStep(1, "WARM_UP", {
    phases: [{ name: "Upper", targets: [20], weight: 1 }],
    stepDurationSeconds: 60,
  }),
  exerciseStep(2, "SWITCHING", {
    targets: [20, 19],
    scoring: { single: 1, double: 2, treble: 3 },
  }),
  exerciseStep(3, "DOUBLE_PATTERN", { patterns: [[20, 16]] }),
  exerciseStep(4, "TARGET_SCORING", { targets: [20, 19, 18, 25] }),
  exerciseStep(5, "SWITCHING_TARGET_SCORING", { targets: [20, 19, 18] }),
  exerciseStep(6, "SCORE_THRESHOLD", { threshold: 65 }),
  exerciseStep(7, "BULLSEYE_CHECKOUT", { startScore: 81 }),
  exerciseStep(8, "BULL_UP", {}),
  exerciseStep(9, "CHECKOUT_SEQUENCE", {
    firstOutshot: 61,
    lastOutshot: 100,
    dartLimit: 6,
  }),
  exerciseStep(10, "RANDOM_CHECKOUT", {
    minStart: 40,
    maxStart: 170,
    drawSeed: 1,
  }),
  {
    sequenceNumber: 11,
    exerciseTypeKey: "GAME",
    exerciseRulesetVersionKey: null,
    gameTypeKey: "501",
    gameRulesetVersionKey: "501_V1",
    durationSeconds: STEP_DURATION_SECONDS,
    configuration: {},
  },
];

/**
 * Inserts one completed routine activity, its `activity_configurations`
 * snapshot and one completed step session per `ROUTINE_STEPS` element
 * (spec §4.4). The Warm-Up has no capture pair and no play; dart kinds play
 * `UNIVERSAL_SCRIPT` on an `EXERCISE_BLOCK`; the game step plays the 501
 * fixture's own config and script on a `LEG`.
 */
export async function seedRoutineRun(
  db: Db,
  playerId: string,
  fiveOhOne: { configuration: Record<string, unknown>; script: DartScript },
): Promise<{ routineKey: string; stepKinds: readonly string[] }> {
  const steps = ROUTINE_STEPS.map((step) =>
    step.exerciseTypeKey === "GAME"
      ? { ...step, configuration: fiveOhOne.configuration }
      : step,
  );
  await db.execute(sql`
    INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
    VALUES (${ROUTINE_ACTIVITY_ID}::uuid, ${playerId}::uuid,
      (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
      now() - interval '1 hour', now(), now())`);
  const snapshot = {
    routineTemplateId: ROUTINE_TEMPLATE_ID,
    routineName: ROUTINE_NAME,
    steps,
  };
  await db.execute(sql`
    INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
    VALUES (${ROUTINE_CONFIG_ID}::uuid, ${ROUTINE_ACTIVITY_ID}::uuid, ${JSON.stringify(snapshot)}::jsonb, now())`);

  for (const step of steps) {
    const isWarmUp = step.exerciseTypeKey === "WARM_UP";
    const isGame = step.exerciseTypeKey === "GAME";
    await insertSession(db, {
      base: 0xa2000 + step.sequenceNumber * 0x100,
      activityId: ROUTINE_ACTIVITY_ID,
      playerId,
      exerciseTypeKey: step.exerciseTypeKey,
      exerciseRulesetVersionKey: step.exerciseRulesetVersionKey,
      gameTypeKey: step.gameTypeKey,
      rulesetVersionKey: step.gameRulesetVersionKey,
      captured: !isWarmUp,
      routineStepSequenceNumber: step.sequenceNumber,
      configuration: step.configuration,
      play: isWarmUp
        ? null
        : isGame
          ? { stageTypeKey: "LEG", script: fiveOhOne.script }
          : { stageTypeKey: "EXERCISE_BLOCK", script: UNIVERSAL_SCRIPT },
    });
  }

  return {
    routineKey: ROUTINE_TEMPLATE_ID,
    stepKinds: steps.map((step) => step.exerciseTypeKey),
  };
}
