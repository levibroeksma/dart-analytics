import "@modules/game/around-the-clock.engine.module";
import "@modules/game/bobs27.engine.module";
import "@modules/game/doubles-training.engine.module";
import "@modules/game/five-oh-one.engine.module";
import "@modules/game/one-twenty-one.engine.module";
import "@modules/game/score-training.engine.module";
import "@modules/game/shanghai.engine.module";
import "@modules/game/singles-training.engine.module";
import "@modules/game/tuod.engine.module";
import "@modules/training/exercises/bull-up.engine.module";
import "@modules/training/exercises/bullseye-checkout.engine.module";
import "@modules/training/exercises/double-pattern.engine.module";
import "@modules/training/exercises/score-threshold.engine.module";
import "@modules/training/exercises/switching-target-scoring.engine.module";
import "@modules/training/exercises/switching.engine.module";
import "@modules/training/exercises/target-scoring.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { seatOf } from "@modules/game/seat-rota.module";
import { replayFacts } from "@modules/stats/replay.module";
import { snapshotOf } from "@modules/stats/x01-checkout-sessions.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type {
  ExerciseRulesetVersionKey,
  RulesetVersionKey,
  SeatFact,
} from "@lib/types";
import type {
  DartExerciseEngineFactory,
  GameEngineFactory,
} from "@modules/interfaces";
import type { EngineFacts } from "@modules/types";
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

type ReplayParticipant = ReplayHeaderSchemaData["participants"][number];
type AnyEngineFactory = GameEngineFactory<unknown, unknown, unknown>;
type AnyDartExerciseEngineFactory = DartExerciseEngineFactory<unknown, unknown>;

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
 * Every state a `create(config, prior).state()` factory can rebuild, the
 * way a play page resumes: the state before any turn, then the state after
 * each turn in play order. Shared by the game and dart exercise fold paths,
 * which differ only in what `create` needs to check before folding (a
 * game's seats, an exercise's none).
 * @throws when a turn names a stage outside the session, or when the engine
 *   throws.
 */
function statesFrom(
  create: (facts: EngineFacts) => { state(): unknown },
  facts: EngineFacts,
): unknown[] {
  const initial = create({ stages: [], turns: [] }).state();
  return [
    initial,
    ...facts.turns.map((_turn, index) =>
      create(factsUpTo(facts, index)).state(),
    ),
  ];
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
  return statesFrom((f) => factory.create(snapshot, f), facts);
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

/** `statesFrom` over a dart exercise factory, or `null` when rebuilding any one of them throws. */
function tryExerciseStatesOf(
  factory: AnyDartExerciseEngineFactory,
  config: unknown,
  facts: EngineFacts,
): unknown[] | null {
  try {
    return statesFrom((f) => factory.create(config, f), facts);
  } catch {
    return null;
  }
}

function foldFrom(
  facts: EngineFacts,
  snapshot: ReplaySnapshot,
  states: unknown[],
): ReplayFold {
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

/**
 * Replays a session's loaded turns through its ruleset's game engine (D371
 * decision 8). Skipped, never guessed: no decodable snapshot, no registered
 * engine, a seatless snapshot with more than one participant, or an engine
 * that throws on any turn leaves the whole session with stored facts only.
 */
function foldGameReplay(
  header: ReplayHeaderSchemaData,
  turns: readonly ReplayTurnSchemaData[],
): ReplayFold {
  const decoded =
    header.configuration === null
      ? null
      : snapshotOf(
          header.rulesetVersionKey as RulesetVersionKey,
          header.configuration,
        );
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
  return foldFrom(facts, snapshot, states);
}

/**
 * Replays a non-game routine step's loaded turns through its exercise
 * ruleset's dart exercise engine (phase 6b plan decision 11). A dart
 * exercise engine reads no seat off its config -- `foldSwitchingState` and
 * its siblings fold every turn's darts regardless of `participantRef` -- so
 * there is no seatless-snapshot concern here, and the snapshot carried on
 * the fold is the step's own configuration with an empty `seats: []` filler
 * only to satisfy `ReplaySnapshot`'s shape; no exercise presenter reads it.
 * Skipped, never guessed: no stored configuration, no registered engine for
 * `exerciseRulesetVersionKey`, or an engine that throws on any turn.
 */
function foldExerciseReplay(
  header: ReplayHeaderSchemaData,
  turns: readonly ReplayTurnSchemaData[],
): ReplayFold {
  if (header.configuration === null) return skipped("NO_SNAPSHOT");
  if (header.exerciseRulesetVersionKey === null) {
    return skipped("NO_EXERCISE_ENGINE");
  }
  const factory = getDartExerciseEngineFactory(
    header.exerciseRulesetVersionKey as ExerciseRulesetVersionKey,
  );
  if (!factory) return skipped("NO_EXERCISE_ENGINE");
  const facts = replayFacts(header.stages, turns);
  const states = tryExerciseStatesOf(factory, header.configuration, facts);
  if (!states) return skipped("ENGINE_THREW");
  const snapshot: ReplaySnapshot = { ...header.configuration, seats: [] };
  return foldFrom(facts, snapshot, states);
}

/**
 * Replays a session's loaded turns through its own engine (D371 decision 8;
 * phase 6b plan decision 11): a game session (`gameTypeKey` set) folds
 * through `getEngineFactory`, a non-game routine step through
 * `getDartExerciseEngineFactory`.
 */
export function foldReplay(
  header: ReplayHeaderSchemaData,
  turns: readonly ReplayTurnSchemaData[],
): ReplayFold {
  return header.gameTypeKey === null
    ? foldExerciseReplay(header, turns)
    : foldGameReplay(header, turns);
}
