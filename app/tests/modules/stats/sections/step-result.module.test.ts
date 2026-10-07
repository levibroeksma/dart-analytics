import { describe, expect, it } from "vitest";
import {
  foldStepResult,
  stepResultBuckets,
} from "@modules/stats/sections/step-result.module";
import type {
  DartZoneKey,
  StepFoldBucketRow,
  StepFoldSession,
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
    stageSequence: 1,
    stageTypeKey: "EXERCISE_BLOCK",
    parentStageId: null,
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

/** `dartRow`'s bucket rows for `stepResultBuckets`, one bucket tag applied to every row. */
function bucketRow(
  bucketStart: string,
  bucketEnd: string,
  overrides: Partial<StepFoldSession> = {},
): StepFoldBucketRow {
  return { ...dartRow(overrides), bucketStart, bucketEnd };
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

  it("replays a Catch 40 session's visits into its points, checkouts and attempts", () => {
    const catch40 = (
      turnSequence: number,
      dartNumber: number,
      hitTargetNumber: number,
      hitZoneKey: DartZoneKey,
      score: number,
    ) =>
      dartRow({
        sessionId: "c40",
        exerciseRulesetVersionKey: "CHECKOUT_SEQUENCE_V1",
        configuration: { firstOutshot: 61, lastOutshot: 100, dartLimit: 6 },
        turnSequence,
        dartNumber,
        hitTargetNumber,
        hitZoneKey,
        score,
      });

    const result = foldStepResult("CHECKOUT_SEQUENCE", [
      catch40(1, 1, 15, "TREBLE", 45),
      catch40(1, 2, 8, "DOUBLE", 16),
      catch40(2, 1, 20, "SINGLE", 20),
    ]);

    expect(result.metrics).toEqual({
      points: 3,
      checkouts: 1,
      attempts: 1,
      darts: 3,
    });
    expect(result.sessions).toBe(1);
    expect(result.skippedSessions).toBe(0);
  });

  it("replays a two-stage session in stage pre-order, never interleaving the stages' turns", () => {
    const ROOT = "01900000-0000-7000-9000-0000000000a1";
    const CHILD = "01900000-0000-7000-9000-0000000000a2";
    const dart = (
      stageId: string,
      turnSequence: number,
      dartNumber: number,
      hit: boolean,
    ) =>
      dartRow({
        sessionId: "ts-staged",
        exerciseRulesetVersionKey: "TARGET_SCORING_V1",
        configuration: { targets: [20] },
        stageId,
        stageSequence: 1,
        parentStageId: stageId === CHILD ? ROOT : null,
        turnSequence,
        dartNumber,
        intendedTargetNumber: 20,
        intendedZoneKey: "TREBLE" as DartZoneKey,
        hitTargetNumber: hit ? 20 : 5,
        hitZoneKey: "SINGLE" as DartZoneKey,
        score: hit ? 1 : 0,
      });
    const rowsInQueryOrder = [
      dart(ROOT, 1, 1, true),
      dart(CHILD, 1, 1, true),
      dart(ROOT, 1, 2, true),
      dart(ROOT, 2, 1, false),
      dart(CHILD, 2, 1, true),
    ];

    const result = foldStepResult("TARGET_SCORING", rowsInQueryOrder);

    expect(result.metrics).toEqual({ bestChain: 2, darts: 5, hits: 4 });
    expect(result.sessions).toBe(1);
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

  it("skips a session with no exerciseRulesetVersionKey, without throwing", () => {
    const rows = switchingSession("session-a", "2026-01-05T00:00:00.000Z", [
      { target: 20, hitTargetNumber: 20, hitZoneKey: "TREBLE" as DartZoneKey },
    ]).map((row) => ({
      ...row,
      exerciseRulesetVersionKey: null,
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

  it("skips a session whose stored configuration fails the ruleset's own schema, without throwing", () => {
    const rows = switchingSession("session-a", "2026-01-05T00:00:00.000Z", [
      { target: 20, hitTargetNumber: 20, hitZoneKey: "TREBLE" as DartZoneKey },
    ]).map((row) => ({ ...row, configuration: null }));

    const result = foldStepResult("SWITCHING", rows);

    expect(result).toEqual({
      metrics: { points: 0, darts: 0, hits: 0 },
      headlineMin: null,
      headlineMax: null,
      sessions: 0,
      skippedSessions: 1,
    });
  });

  it("skips a session whose replayed engine state doesn't match the requested kind's metrics, without throwing", () => {
    // A real Switching session replayed as if it were BULL_UP: the engine
    // state that comes back has no `throws`/`bullseyes`/`bulls` fields, so
    // `stepMetrics` throws -- proving that throw is caught, not just the
    // engine-create one.
    const rows = switchingSession("session-a", "2026-01-05T00:00:00.000Z", [
      { target: 20, hitTargetNumber: 20, hitZoneKey: "TREBLE" as DartZoneKey },
    ]);

    const result = foldStepResult("BULL_UP", rows);

    expect(result).toEqual({
      metrics: { throws: 0, bullseyes: 0, bulls: 0 },
      headlineMin: null,
      headlineMax: null,
      sessions: 0,
      skippedSessions: 1,
    });
  });

  it("folds one session and skips another in the same scope", () => {
    // Cycling starts at targets[0] every fresh session: dart 1 intends 20
    // (TREBLE hit, scoring.treble = 3), dart 2 intends 19 (SINGLE hit,
    // scoring.single = 1) -- 4 points, 2 darts, 2 hits.
    const folded = switchingSession("session-a", "2026-01-05T00:00:00.000Z", [
      { target: 20, hitTargetNumber: 20, hitZoneKey: "TREBLE" as DartZoneKey },
      { target: 19, hitTargetNumber: 19, hitZoneKey: "SINGLE" as DartZoneKey },
    ]);
    const skipped = switchingSession("session-b", "2026-01-06T00:00:00.000Z", [
      { target: 20, hitTargetNumber: 20, hitZoneKey: "TREBLE" as DartZoneKey },
    ]).map((row) => ({ ...row, exerciseRulesetVersionKey: "MADE_UP_V1" }));

    const result = foldStepResult("SWITCHING", [...folded, ...skipped]);

    expect(result.metrics).toEqual({ points: 4, darts: 2, hits: 2 });
    expect(result.sessions).toBe(1);
    expect(result.skippedSessions).toBe(1);
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

describe("stepResultBuckets", () => {
  /** One dart hitting cycling target 20 on the treble -- 3 points, 1 dart, 1 hit. */
  function onePointSession(sessionId: string, completedAt: string) {
    return switchingSession(sessionId, completedAt, [
      { target: 20, hitTargetNumber: 20, hitZoneKey: "TREBLE" as DartZoneKey },
    ]);
  }

  it("groups rows by bucket and folds each bucket's own sessions independently", () => {
    const bucketA = onePointSession(
      "session-a",
      "2026-01-05T00:00:00.000Z",
    ).map((row) => ({
      ...row,
      bucketStart: "2026-01-01T00:00:00.000Z",
      bucketEnd: "2026-02-01T00:00:00.000Z",
    }));
    const bucketB = [
      ...onePointSession("session-b", "2026-02-10T00:00:00.000Z"),
      ...onePointSession("session-c", "2026-02-12T00:00:00.000Z"),
    ].map((row) => ({
      ...row,
      bucketStart: "2026-02-01T00:00:00.000Z",
      bucketEnd: "2026-03-01T00:00:00.000Z",
    }));

    const buckets = stepResultBuckets("SWITCHING", [...bucketA, ...bucketB], {
      to: "2026-03-01T00:00:00.000Z",
      now: new Date("2026-03-15T00:00:00.000Z"),
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
      closed: true,
      sampleSize: 1,
      metrics: { metrics: { points: 3, darts: 1, hits: 1 }, sessions: 1 },
    });
    expect(buckets[1]).toMatchObject({
      start: "2026-02-01T00:00:00.000Z",
      end: "2026-03-01T00:00:00.000Z",
      closed: true,
      sampleSize: 2,
      metrics: { metrics: { points: 6, darts: 2, hits: 2 }, sessions: 2 },
    });
  });

  it("returns no buckets for no rows in scope", () => {
    expect(
      stepResultBuckets("SWITCHING", [], {
        to: "2026-03-01T00:00:00.000Z",
        now: new Date("2026-03-15T00:00:00.000Z"),
      }),
    ).toEqual([]);
  });

  it("marks a still-open bucket unclosed", () => {
    const row = bucketRow(
      "2026-03-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
    );

    const [bucket] = stepResultBuckets("SWITCHING", [row], {
      to: "2026-04-01T00:00:00.000Z",
      now: new Date("2026-03-15T00:00:00.000Z"),
    });

    expect(bucket!.closed).toBe(false);
  });
});
