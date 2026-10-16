import { describe, it, expect } from "vitest";
import {
  goldenTrace,
  normalise,
  randomObservation,
  runOracle,
  type OracleEngine,
} from "./engine-oracle";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { DartObservation, EngineFacts } from "@modules/types";

function counter(bias = 0): (prior?: EngineFacts) => OracleEngine {
  return (prior) => {
    const darts: DartObservation[] = prior
      ? prior.turns.flatMap((t) =>
          t.darts.map((d) => ({
            hitTargetNumber: d.hitTargetNumber,
            hitZoneKey: d.hitZoneKey,
            locationX: d.locationX,
            locationY: d.locationY,
          })),
        )
      : [];
    const facts = (): EngineFacts => ({
      stages: [],
      turns: darts.map((d, i) => ({
        clientKey: `random-${Math.random()}`,
        stageClientKey: "block-1",
        participantRef: "p",
        sequence: i + 1,
        completedAt: new Date().toISOString(),
        totalScore: 0,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: d.hitTargetNumber,
            hitZoneKey: d.hitZoneKey,
            score: 0,
            locationX: d.locationX,
            locationY: d.locationY,
          },
        ],
      })),
    });
    return {
      record: (o) => {
        darts.push(o);
        return { n: darts.length + (darts.length > 5 ? bias : 0) };
      },
      undo: () => darts.pop() !== undefined,
      state: () => ({ n: darts.length + (darts.length > 5 ? bias : 0) }),
      facts,
      isComplete: () => false,
    };
  };
}

describe("randomObservation", () => {
  it("is deterministic per seed and always a legal board hit", () => {
    const a = seededUniform(7, 0);
    const b = seededUniform(7, 0);
    for (let i = 0; i < 200; i += 1) {
      const o = randomObservation(a);
      expect(o).toEqual(randomObservation(b));
      if (o.hitZoneKey === "MISS") expect(o.hitTargetNumber).toBeNull();
      else if (o.hitZoneKey === "OUTER_BULL" || o.hitZoneKey === "INNER_BULL")
        expect(o.hitTargetNumber).toBe(25);
      else expect(o.hitTargetNumber).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("normalise", () => {
  it("renames client keys by first appearance and masks timestamps", () => {
    expect(
      normalise({
        turns: [
          { clientKey: "x", stageClientKey: "s", completedAt: "2026-01-01" },
          { clientKey: "y", stageClientKey: "s", completedAt: null },
        ],
      }),
    ).toEqual({
      turns: [
        { clientKey: "k2", stageClientKey: "k1", completedAt: "<t>" },
        { clientKey: "k3", stageClientKey: "k1", completedAt: null },
      ],
    });
  });
});

describe("runOracle", () => {
  it("passes when both sides behave the same", () => {
    expect(() =>
      runOracle({
        build: counter(),
        legacy: counter(),
        seeds: [1, 2, 3],
        steps: 40,
        undoRate: 0.2,
        rehydrateEvery: 7,
      }),
    ).not.toThrow();
  });

  it("names the seed and step of the first divergence", () => {
    expect(() =>
      runOracle({
        build: counter(1),
        legacy: counter(),
        seeds: [1],
        steps: 40,
      }),
    ).toThrow(/seed 1 step \d+: (record|state) diverged/);
  });
});

describe("goldenTrace", () => {
  it("lists every step's outcome and rehydrates from facts", () => {
    const builds: (EngineFacts | undefined)[] = [];
    const build = counter();
    const trace = goldenTrace({
      build: (prior) => {
        builds.push(prior);
        return build(prior);
      },
      seed: 3,
      steps: 10,
      undoRate: 0.3,
      rehydrateEvery: 4,
    }) as { steps: string[] };
    expect(trace.steps).toHaveLength(10);
    expect(
      trace.steps.every((s) => /^(undo (true|false)|record )/.test(s)),
    ).toBe(true);
    expect(builds).toHaveLength(3);
    expect(builds[1]).toBeDefined();
  });

  it("records a thrown message instead of failing", () => {
    const trace = goldenTrace({
      build: () => ({
        record: () => {
          throw new Error("refused");
        },
        undo: () => false,
        state: () => null,
        facts: () => ({ stages: [], turns: [] }),
        isComplete: () => true,
      }),
      seed: 1,
      steps: 5,
      undoRate: 0,
      rehydrateEvery: 100,
    }) as { steps: string[] };
    expect(trace.steps[0]).toMatch(/-> throws refused$/);
  });
});
