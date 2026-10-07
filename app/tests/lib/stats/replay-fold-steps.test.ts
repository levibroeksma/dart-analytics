import { describe, expect, it } from "vitest";
import { foldReplay } from "@lib/stats/replay-fold";
import { playExerciseKind, playSwitching } from "./replay-step-games";

/**
 * `foldReplay`'s non-game step path (phase 6b plan decision 11, R9): a new
 * file, not an edit to the frozen `replay-fold.test.ts` game cases, per
 * controller ruling R9.
 */
describe("foldReplay (non-game routine steps)", () => {
  it("round-trips a scripted Switching session to the engine's own final state", () => {
    const { header, turns, finalState } = playSwitching();

    const fold = foldReplay(header, turns);

    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    expect(fold.stateAfter(turns.length - 1)).toEqual(finalState);
  });

  it("skips with NO_EXERCISE_ENGINE when no dart exercise engine is registered for the ruleset", () => {
    const { header, turns } = playSwitching();

    const fold = foldReplay(
      { ...header, exerciseRulesetVersionKey: "NOT_A_REAL_RULESET_V1" },
      turns,
    );

    expect(fold).toEqual({ ok: false, reason: "NO_EXERCISE_ENGINE" });
  });

  it("skips with NO_EXERCISE_ENGINE when the step's own exerciseRulesetVersionKey is null (R21)", () => {
    const { header, turns } = playSwitching();

    const fold = foldReplay(
      { ...header, exerciseRulesetVersionKey: null },
      turns,
    );

    expect(fold).toEqual({ ok: false, reason: "NO_EXERCISE_ENGINE" });
  });

  it("skips with NO_SNAPSHOT when the step session stored no configuration", () => {
    const { header, turns } = playSwitching();

    const fold = foldReplay({ ...header, configuration: null }, turns);

    expect(fold).toEqual({ ok: false, reason: "NO_SNAPSHOT" });
  });

  it("skips with NO_SNAPSHOT when the stored configuration is not an object (R21)", () => {
    const { header, turns } = playSwitching();

    const fold = foldReplay(
      { ...header, configuration: "not-an-object" as never },
      turns,
    );

    expect(fold).toEqual({ ok: false, reason: "NO_SNAPSHOT" });
  });

  it("skips with ENGINE_THREW when the stored configuration fails the exercise's own schema (R21: an exercise engine parses its own config inside create())", () => {
    const { header, turns } = playSwitching();

    const fold = foldReplay(
      { ...header, configuration: { targets: [] } },
      turns,
    );

    expect(fold).toEqual({ ok: false, reason: "ENGINE_THREW" });
  });

  it("rebuilds each Random Checkout attempt's start score from the snapshot's draw seed", () => {
    const { header, turns, finalState } = playExerciseKind("RANDOM_CHECKOUT");

    const fold = foldReplay(header, turns);

    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    expect(fold.stateAfter(0)).toMatchObject({ startScore: 50, checkouts: 1 });
    expect(fold.stateAfter(1)).toMatchObject({ startScore: 52, attempts: 2 });
    expect(fold.stateAfter(turns.length - 1)).toEqual(finalState);
  });

  it("skips a Random Checkout replay whose snapshot has no draw seed", () => {
    const { header, turns } = playExerciseKind("RANDOM_CHECKOUT");

    const fold = foldReplay(
      { ...header, configuration: { minStart: 40, maxStart: 170 } },
      turns,
    );

    expect(fold).toEqual({ ok: false, reason: "ENGINE_THREW" });
  });
});
