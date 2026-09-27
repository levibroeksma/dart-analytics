import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import {
  activeTargetOf as activeTargetOfAroundTheClock,
  applyAroundTheClockDart,
  initialAroundTheClockState,
  rulesOf,
} from "@modules/game/around-the-clock.engine.module";
import {
  applyBobs27Dart,
  initialBobs27State,
} from "@modules/game/bobs27.engine.module";
import { foldSeatSteps } from "@modules/game/seat-state.module";
import {
  activeTargetOf as activeTargetOfShanghai,
  applyShanghaiDart,
  initialShanghaiState,
} from "@modules/game/shanghai.engine.module";
import {
  activeTargetOf as activeTargetOfSingles,
  applySinglesTrainingDart,
  initialSinglesTrainingState,
} from "@modules/game/singles-training.engine.module";
import { formatTargetKey, isAimHit } from "@lib/stats/target-key";
import type {
  AroundTheClockEngineConfig,
  GameTypeKey,
  IntentZoneKey,
  SeatFact,
  ShanghaiV2Snapshot,
  TargetKey,
} from "@lib/types";
import type {
  AroundTheClockSeatState,
  BoardTarget,
  DartObservation,
  SeatFoldStep,
  ShanghaiSeatState,
  SinglesTrainingSeatState,
} from "@modules/types";
import { snapshotOf } from "./x01-checkout-sessions.module";
import type { AimedDart, DartFoldRow, SessionSteps } from "./types";

/**
 * Stands in for whoever owns `v_stats_dart_facts`'s darts (phase-4 decision
 * 3): the fold is single-seat over the owner's own darts, and the session's
 * stored `seats` are never read, so nothing here depends on this seat's own
 * identity.
 */
const SYNTHETIC_SEAT: SeatFact = {
  participantRef: "derived-aims-seat",
  displayName: "",
  sideKey: "SOLO",
  participantTypeKey: "PLAYER",
};

/** The shape `snapshotOf` decodes a stored snapshot into, once it has decoded. */
type DecodedSnapshot = NonNullable<ReturnType<typeof snapshotOf>>;

/**
 * Rebuilds a decoded snapshot into the one-seat config every walker below
 * folds against (phase-4 decision 3): the session's own stored `seats` are
 * dropped in favour of `SYNTHETIC_SEAT`, so a seatless historical snapshot
 * folds exactly the same as one that named real seats.
 */
function oneSeatConfig(snapshot: DecodedSnapshot): DecodedSnapshot {
  return { ...snapshot, seats: [SYNTHETIC_SEAT] };
}

function observationOf(row: DartFoldRow): DartObservation {
  return {
    hitTargetNumber: row.hitTargetNumber,
    hitZoneKey: row.hitZoneKey,
    locationX: row.locationX,
    locationY: row.locationY,
  };
}

/**
 * Walks one game's one-seat config and dart log through its own reducer,
 * yielding every intermediate seat-state step (`foldSeatSteps`). Keyed by
 * `GameTypeKey` so `sessionSteps` can dispatch on `DartFoldRow.gameTypeKey`
 * directly; a game with no entry here contributes nothing and is skipped.
 */
type Walker = (
  config: DecodedSnapshot,
  darts: readonly DartObservation[],
) => readonly SeatFoldStep<unknown>[];

const WALKERS: Partial<Record<GameTypeKey, Walker>> = {
  SINGLES_TRAINING(config, darts) {
    const singlesConfig = config as Parameters<
      typeof applySinglesTrainingDart
    >[0];
    const initial = initialSinglesTrainingState(singlesConfig).seats[0]!;
    return foldSeatSteps(darts, initial, (state, observation) =>
      applySinglesTrainingDart(singlesConfig, state, observation),
    );
  },
  SHANGHAI(config, darts) {
    const shanghaiConfig = config as Parameters<typeof initialShanghaiState>[0];
    const difficulty =
      "difficulty" in config
        ? (config.difficulty as ShanghaiV2Snapshot["difficulty"])
        : "NORMAL";
    const initial = initialShanghaiState(shanghaiConfig).seats[0]!;
    return foldSeatSteps(darts, initial, (state, observation) =>
      applyShanghaiDart(state, observation, difficulty),
    );
  },
  AROUND_THE_CLOCK(config, darts) {
    const clockConfig = config as AroundTheClockEngineConfig;
    const rules = rulesOf(clockConfig);
    const initial = initialAroundTheClockState(clockConfig).seats[0]!;
    return foldSeatSteps(darts, initial, (state, observation) =>
      applyAroundTheClockDart(state, observation, rules),
    );
  },
  BOBS27(config, darts) {
    const bobs27Config = config as unknown as Parameters<
      typeof applyBobs27Dart
    >[0];
    const seatedConfig = config as Parameters<typeof initialBobs27State>[0];
    const initial = initialBobs27State(seatedConfig).seats[0]!;
    return foldSeatSteps(darts, initial, (state, observation) =>
      applyBobs27Dart(bobs27Config, state, observation),
    );
  },
};

/**
 * Groups `rows` by session (first-appearance order), sorts each session's
 * rows by `(turnSequence, dartNumber)` and walks it through its own game's
 * reducer (phase-4 decision 3). A session is skipped, and `skippedSessions`
 * incremented, rather than guessed, whenever the fold cannot replay it
 * (phase-4 decision 4): its game has no walker, its snapshot does not decode
 * (`snapshotOf`), its row count differs from `sessionDartCount`, or the
 * reducer throws (a dart fed after a terminal state).
 */
export function sessionSteps(rows: readonly DartFoldRow[]): {
  sessions: SessionSteps<unknown>[];
  skippedSessions: number;
} {
  const bySession = new Map<string, DartFoldRow[]>();
  for (const row of rows) {
    const existing = bySession.get(row.sessionId);
    if (existing) {
      existing.push(row);
    } else {
      bySession.set(row.sessionId, [row]);
    }
  }

  const sessions: SessionSteps<unknown>[] = [];
  let skippedSessions = 0;

  for (const sessionRows of bySession.values()) {
    const ordered = [...sessionRows].sort(
      (a, b) => a.turnSequence - b.turnSequence || a.dartNumber - b.dartNumber,
    );
    const first = ordered[0]!;
    const walker = WALKERS[first.gameTypeKey];
    const snapshot = walker
      ? snapshotOf(first.rulesetVersionKey, first.configuration)
      : null;

    if (
      !walker ||
      snapshot === null ||
      ordered.length !== first.sessionDartCount
    ) {
      skippedSessions += 1;
      continue;
    }

    try {
      const steps = walker(oneSeatConfig(snapshot), ordered.map(observationOf));
      sessions.push({
        sessionId: first.sessionId,
        rulesetVersionKey: first.rulesetVersionKey,
        configuration: first.configuration,
        bucketStart: first.bucketStart,
        bucketEnd: first.bucketEnd,
        steps,
      });
    } catch {
      skippedSessions += 1;
    }
  }

  return { sessions, skippedSessions };
}

/** The three games `aimedDarts` recovers an aim for (phase-4 decision 1). */
type DerivedGame = "SINGLES_TRAINING" | "SHANGHAI" | "AROUND_THE_CLOCK";

/** Which of the three derived-intent games a session's own ruleset belongs to, or `null` for any other (Bob's 27 included). */
function derivedGameOf(rulesetVersionKey: string): DerivedGame | null {
  if (rulesetVersionKey.startsWith("SINGLES_")) return "SINGLES_TRAINING";
  if (rulesetVersionKey.startsWith("SHANGHAI_")) return "SHANGHAI";
  if (rulesetVersionKey.startsWith("AROUND_THE_CLOCK_")) {
    return "AROUND_THE_CLOCK";
  }
  return null;
}

function activeTargetFor(
  game: DerivedGame,
  before: unknown,
  config: DecodedSnapshot,
): BoardTarget {
  if (game === "SINGLES_TRAINING") {
    return activeTargetOfSingles(
      before as SinglesTrainingSeatState,
      config as Parameters<typeof applySinglesTrainingDart>[0],
    );
  }
  if (game === "SHANGHAI") {
    return activeTargetOfShanghai(before as ShanghaiSeatState);
  }
  return activeTargetOfAroundTheClock(
    before as AroundTheClockSeatState,
    config as AroundTheClockEngineConfig,
  );
}

/**
 * Maps an engine's own `BoardTarget` to an aim key (phase-4 decision 1): BULL
 * is always `BULL:25`; a NUMBER target is `OUTER_SINGLE:n` under Around the
 * Clock's `segmentRule: "OUTER_SINGLE"`, otherwise `NUMBER:n`.
 */
function aimPairFor(
  game: DerivedGame,
  target: BoardTarget,
  config: DecodedSnapshot,
): { number: number; zone: IntentZoneKey } {
  if (target.kind === "BULL") {
    return { number: BULL_TARGET_NUMBER, zone: "BULL" };
  }
  const isOuterSingleOnly =
    game === "AROUND_THE_CLOCK" &&
    rulesOf(config as AroundTheClockEngineConfig).segmentRule ===
      "OUTER_SINGLE";
  return {
    number: target.number,
    zone: isOuterSingleOnly ? "OUTER_SINGLE" : "NUMBER",
  };
}

/**
 * The aim key for one Around the Clock seat step's `before` state (phase-4
 * decision 1), shared with `aimedDarts` so `atc-darts-per-target.module.ts`
 * (Task 7) never rebuilds the NUMBER/OUTER_SINGLE/BULL mapping on its own.
 */
export function aroundTheClockAimKey(
  before: AroundTheClockSeatState,
  config: AroundTheClockEngineConfig,
): TargetKey {
  const target = activeTargetOfAroundTheClock(before, config);
  const aimPair = aimPairFor(
    "AROUND_THE_CLOCK",
    target,
    config as DecodedSnapshot,
  );
  return formatTargetKey(aimPair.number, aimPair.zone);
}

/**
 * A `v_stats_dart_facts` dart always carries a coordinate pair — the view
 * filters out any row missing one — so a session that survived
 * `sessionSteps`'s row-count skip rule can never hand `aimedDarts` a null
 * one.
 */
function coordinateOf(value: number | null): number {
  if (value === null) {
    throw new Error(
      "A dart from v_stats_dart_facts always carries a coordinate pair",
    );
  }
  return value;
}

/**
 * Recovers every dart's aim in one Singles Training, Shanghai or Around the
 * Clock session's fold (phase-4 decision 1): the engine's own active target
 * before the dart, mapped to an aim key, and whether the dart hit it
 * (`isAimHit`, phase-4 decision 2). Any other game's session — Bob's 27
 * included — yields nothing; its stored intent is read some other way.
 */
export function aimedDarts(session: SessionSteps<unknown>): AimedDart[] {
  const game = derivedGameOf(session.rulesetVersionKey);
  if (game === null) return [];

  const snapshot = snapshotOf(session.rulesetVersionKey, session.configuration);
  if (snapshot === null) return [];
  const config = oneSeatConfig(snapshot);

  return session.steps.map((step) => {
    const target = activeTargetFor(game, step.before, config);
    const aimPair = aimPairFor(game, target, config);
    const observation = step.observation;

    return {
      aim: formatTargetKey(aimPair.number, aimPair.zone),
      hit: isAimHit(aimPair, {
        number: observation.hitTargetNumber,
        zone: observation.hitZoneKey,
      }),
      hitNumber: observation.hitTargetNumber,
      hitZone: observation.hitZoneKey,
      x: coordinateOf(observation.locationX),
      y: coordinateOf(observation.locationY),
    };
  });
}
