import { describe, expect, it } from "vitest";
import { DartFact, StageFact, TurnFact } from "@routes/sessions/types";

// Executes the boundary values each `// MIRRORS: chk_x` anchor in
// app/src/pages/api/sessions/types.ts declares agreement with.
// Unlike check-constraint-mirror.sh (which only proves an anchor exists),
// this runs safeParse against the real schema and asserts the real
// accept/reject outcome — the same "declared manifest, executed boundary"
// split as refinement-contract.test.ts.

const validDart = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 20,
  hitZoneKey: "SINGLE",
  score: 20,
};

describe("darts CHECK constraint mirrors", () => {
  it("chk_dart_number / chk_dart_number_positive: sequence must be positive", () => {
    expect(DartFact.safeParse({ ...validDart, sequence: 1 }).success).toBe(
      true,
    );
    expect(DartFact.safeParse({ ...validDart, sequence: 0 }).success).toBe(
      false,
    );
    expect(DartFact.safeParse({ ...validDart, sequence: -1 }).success).toBe(
      false,
    );
  });

  it("chk_dart_score_positive: score must be non-negative", () => {
    expect(DartFact.safeParse({ ...validDart, score: 0 }).success).toBe(true);
    expect(DartFact.safeParse({ ...validDart, score: -1 }).success).toBe(false);
  });

  it("chk_intended_target / chk_hit_target: target numbers bound to 1..25 or null", () => {
    expect(
      DartFact.safeParse({ ...validDart, hitTargetNumber: 1 }).success,
    ).toBe(true);
    expect(
      DartFact.safeParse({ ...validDart, hitTargetNumber: 25 }).success,
    ).toBe(true);
    expect(
      DartFact.safeParse({ ...validDart, hitTargetNumber: null }).success,
    ).toBe(true);
    expect(
      DartFact.safeParse({ ...validDart, hitTargetNumber: 0 }).success,
    ).toBe(false);
    expect(
      DartFact.safeParse({ ...validDart, hitTargetNumber: 26 }).success,
    ).toBe(false);
    expect(
      DartFact.safeParse({ ...validDart, intendedTargetNumber: 0 }).success,
    ).toBe(false);
  });

  it("chk_dart_target_consistency: an intended target requires an intended zone", () => {
    expect(
      DartFact.safeParse({
        ...validDart,
        intendedTargetNumber: 20,
        intendedZoneKey: null,
      }).success,
    ).toBe(false);
    expect(
      DartFact.safeParse({
        ...validDart,
        intendedTargetNumber: 20,
        intendedZoneKey: "DOUBLE",
      }).success,
    ).toBe(true);
  });

  it("chk_hit_consistency: hitZoneKey is always required (never null or missing)", () => {
    expect(
      DartFact.safeParse({ ...validDart, hitZoneKey: undefined }).success,
    ).toBe(false);
  });
});

describe("turns CHECK constraint mirror", () => {
  const base = {
    clientKey: "turn-1",
    participantRef: "p-1",
    sequence: 1,
    totalScore: 0,
    completedAt: null,
    darts: [],
  };

  it("chk_turn_sequence_positive: sequence must be positive", () => {
    expect(TurnFact.safeParse(base).success).toBe(true);
    expect(TurnFact.safeParse({ ...base, sequence: 0 }).success).toBe(false);
  });
});

describe("exercise_stages CHECK constraint mirrors", () => {
  const base = {
    clientKey: "stage-1",
    stageTypeKey: "EXERCISE_BLOCK",
    parentClientKey: null,
    sequence: 1,
    turns: [],
  };

  it("chk_stage_sequence_positive: sequence must be positive", () => {
    expect(StageFact.safeParse(base).success).toBe(true);
    expect(StageFact.safeParse({ ...base, sequence: 0 }).success).toBe(false);
  });

  it("chk_stage_not_self_parent: a stage cannot be its own parent", () => {
    expect(
      StageFact.safeParse({ ...base, parentClientKey: "stage-1" }).success,
    ).toBe(false);
  });
});
