import { describe, it, expect } from "vitest";
import { ScoreTrainingEngine } from "@modules/game/score-training.engine.module";

describe("ScoreTrainingEngine (ROUNDS)", () => {
  it("is not complete until durationValue visits are recorded", () => {
    const engine = new ScoreTrainingEngine({
      durationType: "ROUNDS",
      durationValue: 2,
      maxDartsPerTurn: 3,
    });
    engine.recordVisit(45);
    expect(engine.isComplete(1, false)).toBe(false);
    engine.recordVisit(60);
    expect(engine.isComplete(2, false)).toBe(true);
  });

  it("accumulates total and average", () => {
    const engine = new ScoreTrainingEngine({
      durationType: "ROUNDS",
      durationValue: 2,
      maxDartsPerTurn: 3,
    });
    engine.recordVisit(40);
    engine.recordVisit(60);
    expect(engine.currentTotal()).toBe(100);
    expect(engine.currentAverage()).toBe(50);
  });
});

describe("ScoreTrainingEngine (MINUTES)", () => {
  it("does not complete on a timer expiry before any visit is recorded", () => {
    const engine = new ScoreTrainingEngine({
      durationType: "MINUTES",
      durationValue: 15,
      maxDartsPerTurn: 3,
    });
    expect(engine.isComplete(0, true)).toBe(false);
  });

  it("completes once the timer has expired and at least one visit is recorded", () => {
    const engine = new ScoreTrainingEngine({
      durationType: "MINUTES",
      durationValue: 15,
      maxDartsPerTurn: 3,
    });
    engine.recordVisit(30);
    expect(engine.isComplete(1, true)).toBe(true);
  });

  it("does not complete while the timer has not expired, regardless of visit count", () => {
    const engine = new ScoreTrainingEngine({
      durationType: "MINUTES",
      durationValue: 15,
      maxDartsPerTurn: 3,
    });
    engine.recordVisit(30);
    expect(engine.isComplete(1, false)).toBe(false);
  });
});

describe("ScoreTrainingEngine.recordVisit", () => {
  it("mints an incrementing sequence and a unique clientKey per visit", () => {
    const engine = new ScoreTrainingEngine({
      durationType: "ROUNDS",
      durationValue: 10,
      maxDartsPerTurn: 3,
    });
    const first = engine.recordVisit(20);
    const second = engine.recordVisit(30);
    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(first.clientKey).not.toBe(second.clientKey);
  });

  it("continues sequence numbering from startingSequence on resume, avoiding collisions with pre-existing turns", () => {
    const engine = new ScoreTrainingEngine({
      durationType: "ROUNDS",
      durationValue: 10,
      maxDartsPerTurn: 3,
      startingSequence: 3,
    });
    const first = engine.recordVisit(20);
    const second = engine.recordVisit(30);
    expect(first.sequence).toBe(4);
    expect(second.sequence).toBe(5);
    expect([1, 2, 3]).not.toContain(first.sequence);
    expect([1, 2, 3]).not.toContain(second.sequence);
  });
});

describe("ScoreTrainingEngine.undoLastVisit", () => {
  it("pops the last visit and returns true; next recordVisit reuses that sequence", () => {
    const engine = new ScoreTrainingEngine({
      durationType: "ROUNDS",
      durationValue: 10,
      maxDartsPerTurn: 3,
    });
    engine.recordVisit(40);
    engine.recordVisit(60);
    expect(engine.undoLastVisit()).toBe(true);
    expect(engine.currentTotal()).toBe(40);
    const next = engine.recordVisit(50);
    expect(next.sequence).toBe(2);
    expect(engine.currentTotal()).toBe(90);
  });

  it("returns false when there are no visits", () => {
    const engine = new ScoreTrainingEngine({
      durationType: "ROUNDS",
      durationValue: 10,
      maxDartsPerTurn: 3,
    });
    expect(engine.undoLastVisit()).toBe(false);
  });
});
