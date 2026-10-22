// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  STEP_ADAPTERS,
  resolveStepAdapter,
  stepAdapterKey,
} from "@lib/training/routines/adapters/step-adapter.registry";
import { ROUTINE_GAME_STEPS } from "@services/routines/game-step";
import { hitCountAdapter } from "@lib/training/routines/adapters/hit-count.adapter";
import { switchbladeAdapter } from "@lib/training/routines/adapters/switchblade.adapter";
import { doublesLockAdapter } from "@lib/training/routines/adapters/doubles-lock.adapter";
import { halveItAdapter } from "@lib/training/routines/adapters/halve-it.adapter";

describe("step adapter registry", () => {
  it("has one adapter per non-game kind and per server-eligible game ruleset", () => {
    const keys = Object.keys(STEP_ADAPTERS).sort();
    expect(keys).toEqual(
      [
        "WARM_UP",
        "SWITCHING",
        "SWITCHING_CHAIN",
        "DOUBLE_PATTERN",
        "TARGET_SCORING",
        "SCORE_THRESHOLD",
        "BULLSEYE_CHECKOUT",
        "BULL_UP",
        "CHECKOUT_SEQUENCE",
        "RANDOM_CHECKOUT",
        "HIT_COUNT",
        "SWITCHBLADE",
        "DOUBLES_LOCK",
        "HALVE_IT",
        ...Object.keys(ROUTINE_GAME_STEPS).map((k) => `GAME:${k}`),
      ].sort(),
    );
  });

  it("resolves the 65 or More step", () => {
    expect(resolveStepAdapter("SCORE_THRESHOLD")?.headerLabel).toBe(
      "65 or more",
    );
  });

  it("resolves the Bullseye Checkouts step", () => {
    expect(resolveStepAdapter("BULLSEYE_CHECKOUT")?.headerLabel).toBe(
      "Bullseye checkouts",
    );
  });

  it("resolves the Bull Up Practice step", () => {
    expect(resolveStepAdapter("BULL_UP")?.headerLabel).toBe("Bull up practice");
  });

  it("resolves the Catch 40 step", () => {
    expect(resolveStepAdapter("CHECKOUT_SEQUENCE")?.headerLabel).toBe(
      "Catch 40",
    );
  });

  it("resolves the Random Checkout step", () => {
    expect(resolveStepAdapter("RANDOM_CHECKOUT")?.headerLabel).toBe(
      "Random Checkout",
    );
  });

  it("resolves the Hit Count step", () => {
    expect(resolveStepAdapter("HIT_COUNT")?.title).toBe("Hit Count");
    expect(STEP_ADAPTERS.HIT_COUNT).toBe(hitCountAdapter);
  });

  it("resolves the SwitchBlade step", () => {
    expect(resolveStepAdapter("SWITCHBLADE")?.title).toBe("SwitchBlade");
    expect(STEP_ADAPTERS.SWITCHBLADE).toBe(switchbladeAdapter);
  });

  it("resolves the Doubles Lock step", () => {
    expect(resolveStepAdapter("DOUBLES_LOCK")?.title).toBe("Doubles Lock");
    expect(STEP_ADAPTERS.DOUBLES_LOCK).toBe(doublesLockAdapter);
  });

  it("resolves the Halve-It step", () => {
    expect(resolveStepAdapter("HALVE_IT")?.title).toBe("Halve-It");
    expect(STEP_ADAPTERS.HALVE_IT).toBe(halveItAdapter);
  });

  it("derives the key from a resolved step", () => {
    expect(
      stepAdapterKey({
        exerciseTypeKey: "SWITCHING",
        exerciseRulesetVersionKey: "SWITCHING_V1",
        gameRulesetVersionKey: null,
      }),
    ).toBe("SWITCHING");
    expect(
      stepAdapterKey({
        exerciseTypeKey: "GAME",
        exerciseRulesetVersionKey: null,
        gameRulesetVersionKey: "TUOD_V1",
      }),
    ).toBe("GAME:TUOD_V1");
  });

  it("keys Switching's Chain ruleset on its own adapter, not the type's", () => {
    expect(
      stepAdapterKey({
        exerciseTypeKey: "SWITCHING",
        exerciseRulesetVersionKey: "SWITCHING_CHAIN_V1",
        gameRulesetVersionKey: null,
      }),
    ).toBe("SWITCHING_CHAIN");
  });

  it("falls back to the exercise type when the step names no exercise ruleset", () => {
    expect(
      stepAdapterKey({
        exerciseTypeKey: "SWITCHING",
        exerciseRulesetVersionKey: null,
        gameRulesetVersionKey: null,
      }),
    ).toBe("SWITCHING");
  });

  it("header labels are the Phase-1 strings for the four seeded kinds", () => {
    expect(resolveStepAdapter("WARM_UP")?.headerLabel).toBe("warm up");
    expect(resolveStepAdapter("SWITCHING")?.headerLabel).toBe("switching");
    expect(resolveStepAdapter("DOUBLE_PATTERN")?.headerLabel).toBe("doubles");
    expect(resolveStepAdapter("TARGET_SCORING")?.headerLabel).toBe(
      "target scoring",
    );
    expect(resolveStepAdapter("SWITCHING_CHAIN")?.headerLabel).toBe(
      "switching chain",
    );
    expect(resolveStepAdapter("GAME:TUOD_V1")?.headerLabel).toBe("finishing");
    expect(resolveStepAdapter("GAME:SCORE_TRAINING_V1")?.headerLabel).toBe(
      "scoring",
    );
    expect(resolveStepAdapter("GAME:121_V2")?.headerLabel).toBe("121");
  });

  it("resolves the Around the Clock step to its own header and panel", () => {
    const adapter = resolveStepAdapter("GAME:AROUND_THE_CLOCK_V2")!;
    expect(adapter.headerLabel).toBe("around the clock");
    expect(adapter.panel).toBe("around-the-clock");
  });

  it("an unknown key resolves to nothing", () => {
    expect(resolveStepAdapter("GAME:501_V1")).toBeUndefined();
  });
});

describe("STEP_ADAPTERS titles", () => {
  it("gives every step kind a Title Case header title", () => {
    expect(
      Object.fromEntries(
        Object.values(STEP_ADAPTERS).map((adapter) => [
          adapter.key,
          adapter.title,
        ]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "BULLSEYE_CHECKOUT": "Bullseye Checkouts",
        "BULL_UP": "Bull Up Practice",
        "CHECKOUT_SEQUENCE": "Catch 40",
        "DOUBLES_LOCK": "Doubles Lock",
        "DOUBLE_PATTERN": "Double Pattern",
        "GAME:121_V2": "121",
        "GAME:AROUND_THE_CLOCK_V2": "Around the Clock",
        "GAME:SCORE_TRAINING_V1": "Score Training",
        "GAME:TUOD_V1": "Ten Up One Down",
        "HALVE_IT": "Halve-It",
        "HIT_COUNT": "Hit Count",
        "RANDOM_CHECKOUT": "Random Checkout",
        "SCORE_THRESHOLD": "65 or More",
        "SWITCHBLADE": "SwitchBlade",
        "SWITCHING": "Switching",
        "SWITCHING_CHAIN": "Switching Chain",
        "TARGET_SCORING": "Target Scoring",
        "WARM_UP": "Warm-Up",
      }
    `);
  });
});
