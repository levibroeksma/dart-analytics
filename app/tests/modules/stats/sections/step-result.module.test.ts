import { describe, expect, it } from "vitest";
import {
  foldStepResult,
  mergeStepResult,
} from "@modules/stats/sections/step-result.module";
import { STEP_METRIC_SPECS } from "@modules/stats/step-metrics.module";
import type {
  DartZoneKey,
  StepFoldSession,
  StepResultMetric,
} from "@modules/types";

const STAGE_ID = "01900000-0000-7000-9000-000000000001";

function dartRow(overrides: Partial<StepFoldSession> = {}): StepFoldSession {
  return {
    sessionId: "session-1",
    completedAt: "2026-01-05T00:00:00.000Z",
    exerciseRulesetVersionKey: "SWITCHING_V1",
    configuration: {
      targets: [20, 19, 18],
      scoring: { single: 1, double: 2, treble: 3 },
    },
    stageId: STAGE_ID,
    turnSequence: 1,
    participantId: "solo",
    participantName: "Solo",
    participantTypeKey: "PLAYER",
    turnTotalScore: 0,
    dartNumber: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: null,
    hitZoneKey: "SINGLE" as DartZoneKey,
    score: 0,
    locationX: null,
    locationY: null,
    ...overrides,
  };
}

/**
 * A Switching session's three darts, each a hit on the cycling target
 * (`config.targets: [20, 19, 18]`) — points sum matches `scoring`, hits
 * count matches darts thrown.
 */
function switchingSession(
  sessionId: string,
  completedAt: string,
  darts: { target: number; hitTargetNumber: number; hitZoneKey: DartZoneKey }[],
): StepFoldSession[] {
  return darts.map((dart, index) =>
    dartRow({
      sessionId,
      completedAt,
      dartNumber: index + 1,
      intendedTargetNumber: dart.target,
      intendedZoneKey: "TREBLE" as DartZoneKey,
      hitTargetNumber: dart.hitTargetNumber,
      hitZoneKey: dart.hitZoneKey,
      score: dart.hitTargetNumber === dart.target ? 1 : 0,
    }),
  );
}

/** A Target Scoring session's darts against a single target (`config.targets: [20]`). */
function targetScoringSession(
  sessionId: string,
  completedAt: string,
  darts: { hit: boolean; hitZoneKey: DartZoneKey }[],
): StepFoldSession[] {
  return darts.map((dart, index) =>
    dartRow({
      sessionId,
      completedAt,
      exerciseRulesetVersionKey: "TARGET_SCORING_V1",
      configuration: { targets: [20] },
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE" as DartZoneKey,
      dartNumber: index + 1,
      hitTargetNumber: dart.hit ? 20 : 5,
      hitZoneKey: dart.hitZoneKey,
      score: dart.hit ? 1 : 0,
    }),
  );
}

describe("foldStepResult", () => {
  it("sums two scripted Switching sessions' metrics and takes the per-session headline extremes", () => {
    const sessionA = switchingSession("session-a", "2026-01-05T00:00:00.000Z", [
      { target: 20, hitTargetNumber: 20, hitZoneKey: "TREBLE" as DartZoneKey },
      { target: 19, hitTargetNumber: 19, hitZoneKey: "SINGLE" as DartZoneKey },
      { target: 18, hitTargetNumber: 18, hitZoneKey: "DOUBLE" as DartZoneKey },
    ]);
    const sessionB = switchingSession("session-b", "2026-01-06T00:00:00.000Z", [
      { target: 20, hitTargetNumber: 5, hitZoneKey: "SINGLE" as DartZoneKey },
      { target: 19, hitTargetNumber: 19, hitZoneKey: "TREBLE" as DartZoneKey },
      { target: 18, hitTargetNumber: 18, hitZoneKey: "SINGLE" as DartZoneKey },
    ]);

    const result = foldStepResult("SWITCHING", [...sessionA, ...sessionB]);

    expect(result.metrics).toEqual({ points: 10, darts: 6, hits: 5 });
    expect(result.headlineMin).toBe(4);
    expect(result.headlineMax).toBe(6);
    expect(result.sessions).toBe(2);
    expect(result.skippedSessions).toBe(0);
  });

  it("merges bestChain by max, not sum, across Target Scoring sessions", () => {
    const sessionA = targetScoringSession("ts-a", "2026-01-05T00:00:00.000Z", [
      { hit: true, hitZoneKey: "TREBLE" as DartZoneKey },
      { hit: true, hitZoneKey: "SINGLE" as DartZoneKey },
    ]);
    const sessionB = targetScoringSession("ts-b", "2026-01-06T00:00:00.000Z", [
      { hit: true, hitZoneKey: "SINGLE" as DartZoneKey },
      { hit: false, hitZoneKey: "DOUBLE" as DartZoneKey },
      { hit: true, hitZoneKey: "TREBLE" as DartZoneKey },
    ]);

    const result = foldStepResult("TARGET_SCORING", [...sessionA, ...sessionB]);

    expect(result.metrics).toEqual({ bestChain: 4, darts: 5, hits: 4 });
    expect(result.headlineMin).toBe(3);
    expect(result.headlineMax).toBe(4);
    expect(result.sessions).toBe(2);
    expect(result.skippedSessions).toBe(0);
  });

  it("skips a session whose ruleset has no registered engine, without throwing", () => {
    const rows = switchingSession("session-a", "2026-01-05T00:00:00.000Z", [
      { target: 20, hitTargetNumber: 20, hitZoneKey: "TREBLE" as DartZoneKey },
    ]).map((row) => ({
      ...row,
      exerciseRulesetVersionKey: "MADE_UP_V1",
    }));

    const result = foldStepResult("SWITCHING", rows);

    expect(result).toEqual({
      metrics: { points: 0, darts: 0, hits: 0 },
      headlineMin: null,
      headlineMax: null,
      sessions: 0,
      skippedSessions: 1,
    });
  });

  it("returns a zeroed result for no sessions in scope", () => {
    expect(foldStepResult("SWITCHING", [])).toEqual({
      metrics: { points: 0, darts: 0, hits: 0 },
      headlineMin: null,
      headlineMax: null,
      sessions: 0,
      skippedSessions: 0,
    });
  });
});

describe("mergeStepResult", () => {
  const spec = STEP_METRIC_SPECS.SWITCHING;

  function metric(overrides: Partial<StepResultMetric>): StepResultMetric {
    return {
      metrics: { points: 0, darts: 0, hits: 0 },
      headlineMin: null,
      headlineMax: null,
      sessions: 0,
      skippedSessions: 0,
      ...overrides,
    };
  }

  it("sums metrics, sessions and skippedSessions, and takes the tighter/wider headline extreme", () => {
    const a = metric({
      metrics: { points: 6, darts: 3, hits: 3 },
      headlineMin: 6,
      headlineMax: 6,
      sessions: 1,
      skippedSessions: 1,
    });
    const b = metric({
      metrics: { points: 4, darts: 3, hits: 2 },
      headlineMin: 4,
      headlineMax: 4,
      sessions: 1,
      skippedSessions: 0,
    });

    expect(mergeStepResult(spec, a, b)).toEqual({
      metrics: { points: 10, darts: 6, hits: 5 },
      headlineMin: 4,
      headlineMax: 6,
      sessions: 2,
      skippedSessions: 1,
    });
  });

  it("treats a null headline as the merge identity", () => {
    const empty = metric({});
    const some = metric({
      metrics: { points: 6, darts: 3, hits: 3 },
      headlineMin: 6,
      headlineMax: 6,
      sessions: 1,
    });

    expect(mergeStepResult(spec, empty, some)).toEqual(some);
    expect(mergeStepResult(spec, some, empty)).toEqual(some);
  });
});
