import "@modules/game/around-the-clock.engine.module";
import "@modules/game/bobs27.engine.module";
import "@modules/game/doubles-training.engine.module";
import "@modules/game/five-oh-one.engine.module";
import "@modules/game/one-twenty-one.engine.module";
import "@modules/game/score-training.engine.module";
import "@modules/game/shanghai.engine.module";
import "@modules/game/singles-training.engine.module";
import "@modules/game/tuod.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { seatOf } from "@modules/game/seat-rota.module";
import { snapshotOf } from "@modules/stats/x01-checkout-sessions.module";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import type { GameEngineFactory } from "@modules/interfaces";
import type {
  DartFact,
  DartZoneKey,
  EngineFacts,
  StageTypeKey,
  TurnFact,
} from "@modules/types";
import type {
  ReplayHeaderSchemaData,
  ReplayTurnSchemaData,
} from "@routes/types";
import type {
  ReplayFold,
  ReplaySkipReason,
  ReplaySnapshot,
  ReplayStep,
} from "./types";

type ReplayDart = ReplayTurnSchemaData["darts"][number];
type ReplayParticipant = ReplayHeaderSchemaData["participants"][number];
type AnyEngineFactory = GameEngineFactory<unknown, unknown, unknown>;

/**
 * Every replayed turn's `completedAt`. A replay page carries no per-turn
 * completion time, and the engines read `completedAt` only as open (`null`)
 * or closed, never its value: 121, TUOD and Score Training fold closed
 * visits only, and the seat rota hands an open visit back to its thrower.
 * So every loaded turn replays as a closed visit, an abandoned session's
 * unfinished last visit included.
 */
const REPLAYED_TURN_CLOSED_AT = new Date(0).toISOString();

function dartFactOf(dart: ReplayDart): DartFact {
  return {
    sequence: dart.dartNumber,
    intendedTargetNumber: dart.intendedTargetNumber,
    intendedZoneKey: dart.intendedZoneKey as DartZoneKey | null,
    hitTargetNumber: dart.hitTargetNumber,
    hitZoneKey: dart.hitZoneKey as DartZoneKey,
    score: dart.score,
    locationX: dart.locationX,
    locationY: dart.locationY,
  };
}

function turnFactOf(turn: ReplayTurnSchemaData): TurnFact {
  return {
    clientKey: `${turn.stageId}:${turn.turnSequence}`,
    stageClientKey: turn.stageId,
    participantRef: turn.participantId,
    sequence: turn.turnSequence,
    completedAt: REPLAYED_TURN_CLOSED_AT,
    totalScore: turn.turnTotalScore,
    darts: turn.darts.map(dartFactOf),
  };
}

/**
 * The loaded replay as the engine fact log it was played as (D371 decision
 * 8): a stage's client key is its id, a turn's is `stageId:turnSequence`,
 * and a dart's sequence is its dart number.
 */
export function replayFacts(
  stages: ReplayHeaderSchemaData["stages"],
  turns: readonly ReplayTurnSchemaData[],
): EngineFacts {
  return {
    stages: stages.map((stage) => ({
      clientKey: stage.stageId,
      stageTypeKey: stage.stageTypeKey as StageTypeKey,
      parentClientKey: stage.parentStageId,
      sequence: stage.sequence,
    })),
    turns: turns.map(turnFactOf),
  };
}

/** The seat a seatless snapshot's only participant held (`"A"`, the solo side). */
function soloSeat(participant: ReplayParticipant): SeatFact {
  return {
    participantRef: participant.participantId,
    displayName: participant.displayName,
    sideKey: "A",
    participantTypeKey: participant.participantTypeKey,
  } as SeatFact;
}

/**
 * `snapshot` with the seats its engine folds against: its own, else one
 * synthesized from the session's only participant. `null` when there is no
 * seat to fold against and more than one participant it could be.
 */
function seatedSnapshot(
  snapshot: ReplaySnapshot,
  participants: readonly ReplayParticipant[],
): ReplaySnapshot | null {
  if (snapshot.seats.length > 0) return snapshot;
  if (participants.length > 1) return null;
  return { ...snapshot, seats: participants.map(soloSeat) };
}

/**
 * The facts the state after turn `index` folds: every turn up to it, and
 * the stages up to its own in play order -- never a stage an engine opened
 * ahead of the next turn, such as 501's next leg after a checkout.
 * @throws when the turn names a stage outside the session.
 */
function factsUpTo(facts: EngineFacts, index: number): EngineFacts {
  const turn = facts.turns[index]!;
  const stageIndex = facts.stages.findIndex(
    (stage) => stage.clientKey === turn.stageClientKey,
  );
  if (stageIndex === -1) {
    throw new Error(
      `Turn ${turn.clientKey} names a stage outside the session.`,
    );
  }
  return {
    stages: facts.stages.slice(0, stageIndex + 1),
    turns: facts.turns.slice(0, index + 1),
  };
}

/**
 * Every state the replay can show, rebuilt the way a play page resumes
 * (`create(config, prior).state()`): the state before any turn, then the
 * state after each turn in play order.
 * @throws when a turn's participant holds no seat (`seatOf`), when a turn
 *   names a stage outside the session, or when the engine throws.
 */
function statesOf(
  factory: AnyEngineFactory,
  snapshot: ReplaySnapshot,
  facts: EngineFacts,
): unknown[] {
  for (const turn of facts.turns) seatOf(turn, snapshot.seats);
  const initial = factory.create(snapshot, { stages: [], turns: [] }).state();
  return [
    initial,
    ...facts.turns.map((_turn, index) =>
      factory.create(snapshot, factsUpTo(facts, index)).state(),
    ),
  ];
}

/**
 * The state after turn `turnIndex` out of `statesOf`'s list, `-1` the state
 * before any turn.
 * @throws RangeError for an index that names no turn of the replay.
 */
function stateAfter(states: readonly unknown[], turnIndex: number): unknown {
  const position = turnIndex + 1;
  if (
    !Number.isInteger(turnIndex) ||
    position < 0 ||
    position >= states.length
  ) {
    throw new RangeError(`No turn ${turnIndex} in this replay.`);
  }
  return states[position];
}

function skipped(reason: ReplaySkipReason): ReplayFold {
  return { ok: false, reason };
}

/** `statesOf`, or `null` when rebuilding any one of them throws. */
function tryStatesOf(
  factory: AnyEngineFactory,
  snapshot: ReplaySnapshot,
  facts: EngineFacts,
): unknown[] | null {
  try {
    return statesOf(factory, snapshot, facts);
  } catch {
    return null;
  }
}

/**
 * Replays a session's loaded turns through its ruleset's engine (D371
 * decision 8). Skipped, never guessed: no decodable snapshot, no registered
 * engine, a seatless snapshot with more than one participant, or an engine
 * that throws on any turn leaves the whole session with stored facts only.
 */
export function foldReplay(
  header: ReplayHeaderSchemaData,
  turns: readonly ReplayTurnSchemaData[],
): ReplayFold {
  const decoded =
    header.configuration === null
      ? null
      : snapshotOf(header.rulesetVersionKey, header.configuration);
  if (!decoded) return skipped("NO_SNAPSHOT");
  const factory = getEngineFactory(
    header.rulesetVersionKey as RulesetVersionKey,
  );
  if (!factory) return skipped("NO_ENGINE");
  const snapshot = seatedSnapshot(decoded, header.participants);
  if (!snapshot) return skipped("SEATLESS_MULTI");
  const facts = replayFacts(header.stages, turns);
  const states = tryStatesOf(factory, snapshot, facts);
  if (!states) return skipped("ENGINE_THREW");
  const steps: ReplayStep[] = facts.turns.map((turn, index) => ({
    turn,
    before: states[index],
    after: states[index + 1],
  }));
  return {
    ok: true,
    snapshot,
    steps,
    stateAfter: (turnIndex) => stateAfter(states, turnIndex),
  };
}
