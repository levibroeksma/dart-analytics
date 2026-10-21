import { describe, expect, it } from "vitest";
import { trackExerciseSpec } from "@modules/training/exercises/track-exercise-spec.module";
import {
  boardScorePoints,
  closeAfter,
  pathTarget,
} from "@modules/game/track-policies";
import { isHitOn, numbersPath } from "@modules/game/board-progression.module";
import type {
  DartObservation,
  EngineFacts,
  TrackTarget,
  TurnFact,
} from "@modules/types";

type Config = { start: number };
type State = {
  score: number;
  index: number;
  seen: number;
  expired: boolean;
  darts: number;
};

const spec = trackExerciseSpec<Config, { seen: number }, State>({
  exerciseRulesetVersionKey: "TARGET_SCORING_V1",
  parse: (config) => config,
  rules: () => ({
    doneMessage: "never",
    startScore: 5,
    target: pathTarget(numbersPath()),
    hit: isHitOn,
    points: (_target, _observation, hit) => (hit ? 1 : 0),
    onDart: (seat) => ({ ...seat, ext: { seen: seat.ext.seen + 1 } }),
    visitOpen: closeAfter(3),
  }),
  initialExt: (config) => ({ seen: config.start }),
  project: (seat, _config, expired, facts) => ({
    score: seat.score,
    index: seat.targetIndex,
    seen: seat.ext.seen,
    expired,
    darts: facts.turns.flatMap((turn) => turn.darts).length,
  }),
  intent: (state) => ({
    intendedTargetNumber: state.index + 1,
    intendedZoneKey: "SINGLE",
  }),
});

const dart = (n: number): DartObservation => ({
  hitTargetNumber: n,
  hitZoneKey: "SINGLE",
  locationX: null,
  locationY: null,
});

function facts(darts: DartObservation[]): EngineFacts {
  const turn = { darts } as unknown as TurnFact;
  return { stages: [], turns: [turn] };
}

describe("trackExerciseSpec", () => {
  it("folds the solo seat from the rules' start score and initial ext through the kernel", () => {
    expect(spec.fold(facts([dart(1), dart(7)]), { start: 10 }, false)).toEqual({
      score: 6,
      index: 0,
      seen: 12,
      expired: false,
      darts: 2,
    });
  });

  it("passes expiry through to the projection", () => {
    expect(spec.fold(facts([]), { start: 0 }, true).expired).toBe(true);
  });

  it("closes a visit at three darts", () => {
    const open = { darts: [1, 2] } as unknown as TurnFact;
    const full = { darts: [1, 2, 3] } as unknown as TurnFact;
    expect(spec.isVisitOpen(open)).toBe(true);
    expect(spec.isVisitOpen(full)).toBe(false);
  });

  it("keeps the definition's key, parse and intent", () => {
    expect(spec.exerciseRulesetVersionKey).toBe("TARGET_SCORING_V1");
    expect(spec.parse({ start: 3 })).toEqual({ start: 3 });
    expect(
      spec.intent(
        { score: 0, index: 4, seen: 0, expired: false, darts: 0 },
        { start: 0 },
      ),
    ).toEqual({ intendedTargetNumber: 5, intendedZoneKey: "SINGLE" });
  });

  it("folds a ruleset whose path mixes beds and zones", () => {
    const zoneSpec = trackExerciseSpec<
      Record<string, never>,
      null,
      number,
      TrackTarget
    >({
      exerciseRulesetVersionKey: "HIT_COUNT_V1",
      parse: (config) => config,
      rules: () => ({
        doneMessage: "done",
        target: () => ({ kind: "ANY_TREBLE" }),
        hit: isHitOn,
        points: boardScorePoints,
        visitOpen: closeAfter(3),
      }),
      initialExt: () => null,
      project: (seat) => seat.score,
      intent: () => ({
        intendedTargetNumber: null,
        intendedZoneKey: "TREBLE",
      }),
    });
    const treble: DartObservation = {
      hitTargetNumber: 19,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    };
    expect(zoneSpec.fold(facts([treble]), {}, false)).toBe(57);
  });
});
