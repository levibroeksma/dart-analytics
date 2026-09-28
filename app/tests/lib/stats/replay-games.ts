import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { toWireConfig } from "@lib/game/rulesets/config-codec";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { aroundTheClockEngineFactory } from "@modules/game/around-the-clock.engine.module";
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { doublesTrainingEngineFactory } from "@modules/game/doubles-training.engine.module";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { oneTwentyOneEngineFactory } from "@modules/game/one-twenty-one.engine.module";
import { scoreTrainingEngineFactory } from "@modules/game/score-training.engine.module";
import { shanghaiEngineFactory } from "@modules/game/shanghai.engine.module";
import { singlesTrainingEngineFactory } from "@modules/game/singles-training.engine.module";
import { tuodEngineFactory } from "@modules/game/tuod.engine.module";
import type { GameEngineFactory } from "@modules/interfaces";
import type { DartObservation, DartZoneKey, EngineFacts } from "@modules/types";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import type {
  ReplayHeaderSchemaData,
  ReplayTurnSchemaData,
} from "@routes/types";

/**
 * Scripted games for the replay fold and presenter tests: each one is
 * driven through its real engine, then converted into the header and turns
 * the replay route would serve for it, so a test can fold the replay and
 * compare it against the engine that produced it.
 */

export const PLAYER_ONE = {
  participantId: "01900000-0000-7000-8000-000000000001",
  displayName: "Levi",
  participantTypeKey: "PLAYER",
} as const;

export const PLAYER_TWO = {
  participantId: "01900000-0000-7000-8000-000000000002",
  displayName: "Sam",
  participantTypeKey: "GUEST",
} as const;

type Participant = typeof PLAYER_ONE | typeof PLAYER_TWO;

function seatFor(participant: Participant, sideKey: string): SeatFact {
  return {
    participantRef: participant.participantId,
    displayName: participant.displayName,
    sideKey,
    participantTypeKey: participant.participantTypeKey,
  };
}

export const SOLO_SEATS = [seatFor(PLAYER_ONE, "A")];
const DUO_SEATS = [seatFor(PLAYER_ONE, "A"), seatFor(PLAYER_TWO, "B")];

/** Beyond the double ring: `classify` reads it as a MISS. */
const OFF_BOARD = { x: 0, y: -200 };

/**
 * One board dart landing at its zone's centroid, so a coordinate-classifying
 * engine (501) resolves it to the zone named; a MISS lands off the board and
 * carries no target number.
 */
function dart(target: number | null, zone: DartZoneKey): DartObservation {
  const location = zone === "MISS" ? OFF_BOARD : zoneCentroid(target, zone)!;
  return {
    hitTargetNumber: zone === "MISS" ? null : target,
    hitZoneKey: zone,
    locationX: location.x,
    locationY: location.y,
  };
}

const MISS = dart(null, "MISS");

/** The session header every scripted game and skip-reason case starts from. */
export function replayHeader(
  overrides: Partial<ReplayHeaderSchemaData> = {},
): ReplayHeaderSchemaData {
  return {
    sessionId: "01900000-0000-7000-8000-00000000a001",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    inputModeKey: "VISUAL_BOARD",
    statusKey: "COMPLETED",
    contextKey: "STANDALONE",
    activityId: "01900000-0000-7000-8000-00000000b001",
    routineStepSequenceNumber: null,
    configuration: null,
    startedAt: "2026-09-20T10:00:00.000Z",
    completedAt: "2026-09-20T10:20:00.000Z",
    durationSeconds: 1200,
    turnCount: 0,
    dartCount: 0,
    participants: [],
    stages: [],
    ...overrides,
  };
}

function stageId(index: number): string {
  return `01900000-0000-7000-9000-${String(index + 1).padStart(12, "0")}`;
}

/**
 * The header and turns the replay route would serve for `facts`: stage
 * client keys become stage ids, darts carry their `dartNumber`, and the
 * participants are listed in first-turn order.
 */
function replayOf(
  rulesetVersionKey: RulesetVersionKey,
  config: { seats: readonly SeatFact[] },
  facts: EngineFacts,
): { header: ReplayHeaderSchemaData; turns: ReplayTurnSchemaData[] } {
  const stageIds = new Map(
    facts.stages.map((stage, index) => [stage.clientKey, stageId(index)]),
  );
  const turns = facts.turns.map((turn) => ({
    stageId: stageIds.get(turn.stageClientKey)!,
    turnSequence: turn.sequence,
    participantId: turn.participantRef,
    turnTotalScore: turn.totalScore,
    darts: turn.darts.map(({ sequence, ...rest }) => ({
      dartNumber: sequence,
      ...rest,
    })),
  }));
  const firstTurnOrder = [...new Set(turns.map((turn) => turn.participantId))];
  const { seats, ...snapshot } = config;
  return {
    header: replayHeader({
      gameTypeKey: GAME_TYPE_BY_RULESET[rulesetVersionKey],
      rulesetVersionKey,
      configuration: {
        ...toWireConfig(rulesetVersionKey, snapshot as never),
        seats,
      },
      turnCount: turns.length,
      dartCount: turns.reduce((sum, turn) => sum + turn.darts.length, 0),
      participants: firstTurnOrder.map((participantId) => {
        const seat = seats.find((s) => s.participantRef === participantId)!;
        return {
          participantId,
          displayName: seat.displayName,
          participantTypeKey: seat.participantTypeKey,
        };
      }),
      stages: facts.stages.map((stage) => ({
        stageId: stageIds.get(stage.clientKey)!,
        parentStageId: stage.parentClientKey
          ? stageIds.get(stage.parentClientKey)!
          : null,
        stageTypeKey: stage.stageTypeKey,
        sequence: stage.sequence,
      })),
    }),
    turns,
  };
}

export type ScriptedGame = {
  rulesetVersionKey: RulesetVersionKey;
  config: { seats: readonly SeatFact[] };
  facts: EngineFacts;
  /** The live engine's own `state()` after each visit, index-aligned with `turns`. */
  liveStates: unknown[];
  finalState: unknown;
  header: ReplayHeaderSchemaData;
  turns: ReplayTurnSchemaData[];
};

/**
 * Plays `visits` through a fresh engine, one visit per turn, and returns
 * the game alongside the replay the route would serve for it.
 */
function scripted<TConfig extends { seats: readonly SeatFact[] }, TInput>(
  factory: GameEngineFactory<TConfig, TInput, unknown>,
  config: TConfig,
  visits: readonly (readonly TInput[])[],
): ScriptedGame {
  const engine = factory.create(config);
  const liveStates = visits.map((visit) => {
    for (const input of visit) engine.record(input);
    return engine.state();
  });
  const facts = engine.facts();
  return {
    rulesetVersionKey: factory.rulesetVersionKey,
    config,
    facts,
    liveStates,
    finalState: engine.state(),
    ...replayOf(factory.rulesetVersionKey, config, facts),
  };
}

const LOW_TO_HIGH = [...Array.from({ length: 20 }, (_, i) => i + 1), 25];

/**
 * A two-leg 1v1 101 match on the board: leg 1 has a one-dart bust by the
 * eventual winner, leg 2 (started by the other seat) opens with a two-dart
 * bust, and the first seat checks out both legs.
 */
export function playFiveOhOne(): ScriptedGame {
  return scripted(
    fiveOhOneEngineFactory,
    {
      startingScore: 101,
      legsToWin: 2,
      checkIn: "STRAIGHT_IN",
      checkOut: "DOUBLE_OUT",
      maxDartsPerTurn: 3,
      maxVisitScore: 180,
      seats: DUO_SEATS,
    },
    [
      [dart(20, "TREBLE"), dart(1, "OUTER_SINGLE"), dart(20, "OUTER_SINGLE")],
      [
        dart(1, "OUTER_SINGLE"),
        dart(1, "OUTER_SINGLE"),
        dart(1, "INNER_SINGLE"),
      ],
      [dart(20, "OUTER_SINGLE")],
      [
        dart(1, "OUTER_SINGLE"),
        dart(1, "OUTER_SINGLE"),
        dart(1, "OUTER_SINGLE"),
      ],
      [dart(10, "DOUBLE")],
      [dart(20, "TREBLE"), dart(20, "TREBLE")],
      [dart(20, "TREBLE"), dart(1, "OUTER_SINGLE"), dart(20, "DOUBLE")],
    ],
  );
}

/** A 121 ladder by visit total: one attempt checked out on its third visit, then one visit into the next. */
export function playOneTwentyOne(): ScriptedGame {
  return scripted(oneTwentyOneEngineFactory, { seats: SOLO_SEATS }, [
    [{ scoreAttempted: 60 }],
    [{ scoreAttempted: 21 }],
    [{ scoreAttempted: 40, finishedOnDouble: true, dartsUsed: 1 }],
    [{ scoreAttempted: 100 }],
  ]);
}

/** A three-attempt Ten Up One Down: a checkout, a miss, a checkout. */
export function playTuod(): ScriptedGame {
  return scripted(
    tuodEngineFactory,
    {
      startingTarget: 41,
      finishBonus: 10,
      missPenalty: 1,
      durationType: "ROUNDS",
      durationValue: 3,
      maxDartsPerTurn: 3,
      seats: SOLO_SEATS,
    },
    [
      [
        {
          checkedOut: true,
          finishedOnDouble: true,
          dartsUsed: 2,
          dartsAtDouble: 1,
        },
      ],
      [{ checkedOut: false }],
      [
        {
          checkedOut: true,
          finishedOnDouble: true,
          dartsUsed: 3,
          dartsAtDouble: 1,
        },
      ],
    ],
  );
}

/** A three-round 1v1 Score Training by visit total. */
export function playScoreTraining(): ScriptedGame {
  return scripted(
    scoreTrainingEngineFactory,
    {
      durationType: "ROUNDS",
      durationValue: 3,
      maxDartsPerTurn: 3,
      maxVisitScore: 180,
      seats: DUO_SEATS,
    },
    [[60], [45], [100], [26], [81], [140]],
  );
}

/** Three Singles visits: two hits on 1, one hit on 2 among misses, a blank on 3. */
export function playSingles(): ScriptedGame {
  return scripted(
    singlesTrainingEngineFactory,
    {
      orderMode: "LOW_TO_HIGH",
      targetOrder: LOW_TO_HIGH,
      difficulty: "EASY",
      pointsSingle: 1,
      pointsDouble: 2,
      pointsTreble: 3,
      seats: SOLO_SEATS,
    },
    [
      [dart(1, "OUTER_SINGLE"), dart(1, "TREBLE"), MISS],
      [MISS, dart(2, "DOUBLE"), dart(5, "OUTER_SINGLE")],
      [MISS, MISS, MISS],
    ],
  );
}

/** Three Doubles visits: D1 on the second dart, three misses at D2, D3 first dart. */
export function playDoubles(): ScriptedGame {
  return scripted(
    doublesTrainingEngineFactory,
    {
      mode: "EASY",
      orderMode: "LOW_TO_HIGH",
      targetOrder: LOW_TO_HIGH,
      seats: SOLO_SEATS,
    },
    [[MISS, dart(1, "DOUBLE")], [MISS, MISS, MISS], [dart(3, "DOUBLE")]],
  );
}

/** Three Bob's 27 visits: one hit at D1, none at D2, two at D3. */
export function playBobs27(): ScriptedGame {
  return scripted(
    bobs27EngineFactory,
    {
      startScore: 27,
      bullHitValue: 50,
      missPenaltyMultiplier: 1,
      seats: SOLO_SEATS,
    },
    [
      [dart(1, "DOUBLE"), MISS, MISS],
      [MISS, MISS, MISS],
      [dart(3, "DOUBLE"), dart(3, "DOUBLE"), MISS],
    ],
  );
}

/** Three Shanghai rounds: a single and a double on 1, a treble on 2, a blank on 3. */
export function playShanghai(): ScriptedGame {
  return scripted(shanghaiEngineFactory, { seats: SOLO_SEATS }, [
    [dart(1, "OUTER_SINGLE"), dart(1, "DOUBLE"), MISS],
    [dart(2, "TREBLE"), dart(7, "OUTER_SINGLE"), MISS],
    [MISS, MISS, MISS],
  ]);
}

/** Three Around the Clock visits: 1 and 2 hit, then 3 on the last dart, then only a wrong number. */
export function playAroundTheClock(): ScriptedGame {
  return scripted(aroundTheClockEngineFactory, { seats: SOLO_SEATS }, [
    [dart(1, "OUTER_SINGLE"), dart(2, "INNER_SINGLE"), MISS],
    [MISS, MISS, dart(3, "OUTER_SINGLE")],
    [dart(5, "OUTER_SINGLE"), MISS, MISS],
  ]);
}
