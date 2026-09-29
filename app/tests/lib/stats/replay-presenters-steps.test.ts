import { describe, expect, it } from "vitest";
import { foldReplay } from "@lib/stats/replay-fold";
import { STEP_REPLAY_PRESENTERS } from "@lib/stats/replay-presenters";
import type { ReplayFold } from "@lib/types";
import { playSwitching } from "./replay-step-games";

/**
 * `STEP_REPLAY_PRESENTERS`' generic dart exercise builder (phase 6b plan
 * decision 11, R9): a new file, not an edit to the frozen
 * `replay-presenters.test.ts` game cases, per controller ruling R9.
 */
describe("STEP_REPLAY_PRESENTERS", () => {
  function folded(): Extract<ReplayFold, { ok: true }> {
    const { header, turns } = playSwitching();
    const fold = foldReplay(header, turns);
    if (!fold.ok) throw new Error(`fold skipped: ${fold.reason}`);
    return fold;
  }

  it("shows Switching's running points and darts thrown after each turn, equal to the engine's own state", () => {
    const fold = folded();
    const presenter = STEP_REPLAY_PRESENTERS.SWITCHING;

    fold.steps.forEach((step) => {
      const engineState = step.after as {
        totalPoints: number;
        dartsThrown: number;
      };
      const cells = presenter.turn(step, fold.snapshot);
      const points = cells.find(
        (cell) => cell.kind === "value" && cell.label === "Points",
      );
      const darts = cells.find(
        (cell) => cell.kind === "value" && cell.label === "Darts",
      );
      expect(points?.kind === "value" ? points.value : null).toBe(
        String(engineState.totalPoints),
      );
      expect(darts?.kind === "value" ? darts.value : null).toBe(
        String(engineState.dartsThrown),
      );
    });
  });

  it("shows the final metrics on the session line, hits included (derived from the replayed darts)", () => {
    const fold = folded();

    const line = STEP_REPLAY_PRESENTERS.SWITCHING.session(
      fold.steps,
      fold.snapshot,
    );

    expect(line.entries.find((e) => e.label === "Points")?.value).toBe("4");
    expect(line.entries.find((e) => e.label === "Darts")?.value).toBe("3");
    expect(line.entries.find((e) => e.label === "Hits")?.value).toBe("2");
  });

  it("gives an empty session line to a step with no turns", () => {
    expect(STEP_REPLAY_PRESENTERS.SWITCHING.session([], { seats: [] })).toEqual(
      { entries: [], curves: [] },
    );
  });
});
