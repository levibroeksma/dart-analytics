import { describe, expect, it } from "vitest";
import { foldReplay } from "@lib/stats/replay-fold";
import { playSwitching } from "./replay-step-games";

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

  it("skips with NO_SNAPSHOT when the step session stored no configuration", () => {
    const { header, turns } = playSwitching();

    const fold = foldReplay({ ...header, configuration: null }, turns);

    expect(fold).toEqual({ ok: false, reason: "NO_SNAPSHOT" });
  });

  it("skips with ENGINE_THREW when the stored configuration fails the exercise's own schema", () => {
    const { header, turns } = playSwitching();

    const fold = foldReplay(
      { ...header, configuration: { targets: [] } },
      turns,
    );

    expect(fold).toEqual({ ok: false, reason: "ENGINE_THREW" });
  });
});
