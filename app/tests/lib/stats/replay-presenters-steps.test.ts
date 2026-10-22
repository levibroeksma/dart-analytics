import { describe, expect, it } from "vitest";
import { foldReplay } from "@lib/stats/replay-fold";
import {
  STEP_REPLAY_PRESENTERS,
  stepReplayPresenter,
} from "@lib/stats/replay-presenters";
import {
  STEP_METRIC_SPECS,
  stepMetrics,
} from "@modules/stats/step-metrics.module";
import type { ReplayFold } from "@lib/types";
import type { DartExerciseKind, EngineFacts } from "@modules/types";
import { playExerciseKind, playSwitching } from "./replay-step-games";

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
    const presenter = STEP_REPLAY_PRESENTERS["SWITCHING:STANDARD"];

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

    const line = STEP_REPLAY_PRESENTERS["SWITCHING:STANDARD"].session(
      fold.steps,
      fold.snapshot,
    );

    expect(line.entries.find((e) => e.label === "Points")?.value).toBe("4");
    expect(line.entries.find((e) => e.label === "Darts")?.value).toBe("3");
    expect(line.entries.find((e) => e.label === "Hits")?.value).toBe("2");
  });

  it("gives an empty session line to a step with no turns", () => {
    expect(
      STEP_REPLAY_PRESENTERS["SWITCHING:STANDARD"].session([], { seats: [] }),
    ).toEqual({ entries: [], curves: [] });
  });
});

/**
 * Review Focus 4: `DartExerciseKind` is a composite key, so a presenter is
 * resolved from a session's exercise type *and* ruleset version. A session
 * stored before the Chain ruleset existed names only `SWITCHING`/
 * `SWITCHING_V1` and must still render, and a kind this build does not know
 * must degrade to `null` rather than throw.
 */
describe("stepReplayPresenter", () => {
  it("renders a legacy Switching session after the kind key becomes composite", () => {
    const { header, turns } = playSwitching();
    const presenter = stepReplayPresenter({
      exerciseTypeKey: "SWITCHING",
      exerciseRulesetVersionKey: "SWITCHING_V1",
    });
    const fold = foldReplay(header, turns);
    if (!fold.ok) throw new Error(`fold skipped: ${fold.reason}`);

    expect(presenter).not.toBeNull();
    expect(
      presenter!.session(fold.steps, fold.snapshot).entries.map((e) => e.label),
    ).toEqual(["Points", "Darts", "Hits"]);
  });

  it("reads a Switching session with no ruleset version at all as Standard", () => {
    expect(
      stepReplayPresenter({
        exerciseTypeKey: "SWITCHING",
        exerciseRulesetVersionKey: null,
      }),
    ).toBe(STEP_REPLAY_PRESENTERS["SWITCHING:STANDARD"]);
  });

  it("resolves the Chain ruleset to its own presenter, not Standard's", () => {
    expect(
      stepReplayPresenter({
        exerciseTypeKey: "SWITCHING",
        exerciseRulesetVersionKey: "SWITCHING_CHAIN_V1",
      }),
    ).toBe(STEP_REPLAY_PRESENTERS["SWITCHING:CHAIN"]);
  });

  it("degrades rather than throwing on an unknown kind", () => {
    expect(() =>
      stepReplayPresenter({
        exerciseTypeKey: "NOPE",
        exerciseRulesetVersionKey: "NOPE_V1",
      }),
    ).not.toThrow();
    expect(
      stepReplayPresenter({
        exerciseTypeKey: "NOPE",
        exerciseRulesetVersionKey: "NOPE_V1",
      }),
    ).toBeNull();
  });
});

/**
 * Item 5 (fix round 1): every `STEP_METRIC_SPECS` kind, not just Switching
 * -- proves the `NO_FACTS` shortcut `buildStepPresenter`'s `turn()` takes
 * (`replay-presenters.ts` ~386/420) never changes the headline or darts
 * value a real per-turn fact log would give, for every kind,
 * `BULL_UP`'s `"throws"` branch included.
 */
describe("STEP_REPLAY_PRESENTERS (every kind, real engine runs)", () => {
  const KINDS = Object.keys(STEP_METRIC_SPECS) as DartExerciseKind[];

  it("covers Catch 40 and Random Checkout", () => {
    expect(KINDS).toContain("CHECKOUT_SEQUENCE");
    expect(KINDS).toContain("RANDOM_CHECKOUT");
  });

  it("covers both Switching rulesets under their composite keys", () => {
    expect(KINDS).toContain("SWITCHING:STANDARD");
    expect(KINDS).toContain("SWITCHING:CHAIN");
    expect(KINDS).not.toContain("SWITCHING");
  });

  it("is exactly fourteen kinds — a presenter per STEP_METRIC_SPECS entry, no more and no fewer", () => {
    expect(KINDS).toHaveLength(14);
    expect(Object.keys(STEP_REPLAY_PRESENTERS).sort()).toEqual(
      [...KINDS].sort(),
    );
  });

  it("covers Hit Count", () => {
    expect(KINDS).toContain("HIT_COUNT");
  });

  it("covers SwitchBlade", () => {
    expect(KINDS).toContain("SWITCHBLADE");
  });

  it("covers Doubles Lock", () => {
    expect(KINDS).toContain("DOUBLES_LOCK");
  });

  it("covers Halve-It", () => {
    expect(KINDS).toContain("HALVE_IT");
  });

  it("covers Snakes & Ladders", () => {
    expect(KINDS).toContain("DOUBLES_SNAKES_LADDERS");
  });

  it.each(KINDS)(
    "%s: the turn cell's headline and darts value equal stepMetrics over the real replayed facts",
    (kind) => {
      const { header, turns } = playExerciseKind(kind);
      const fold = foldReplay(header, turns);
      if (!fold.ok) throw new Error(`fold skipped: ${fold.reason}`);
      const presenter = STEP_REPLAY_PRESENTERS[kind];
      const spec = STEP_METRIC_SPECS[kind];

      fold.steps.forEach((step, index) => {
        const realFacts: EngineFacts = {
          stages: [],
          turns: fold.steps.slice(0, index + 1).map((s) => s.turn),
        };
        const expected = stepMetrics(kind, step.after, realFacts);
        const dartsKey = "darts" in expected ? "darts" : "throws";
        const [headlineCell, dartsCell] = presenter.turn(step, fold.snapshot);

        expect(headlineCell?.kind === "value" ? headlineCell.value : null).toBe(
          String(expected[spec.headline] ?? "—"),
        );
        expect(dartsCell?.kind === "value" ? dartsCell.value : null).toBe(
          String(expected[dartsKey]),
        );
      });
    },
  );
});
