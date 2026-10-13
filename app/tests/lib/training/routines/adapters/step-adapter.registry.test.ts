// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  STEP_ADAPTERS,
  resolveStepAdapter,
  stepAdapterKey,
} from "@lib/training/routines/adapters/step-adapter.registry";
import { ROUTINE_GAME_STEPS } from "@services/routines/game-step";

describe("step adapter registry", () => {
  it("has one adapter per non-game kind and per server-eligible game ruleset", () => {
    const keys = Object.keys(STEP_ADAPTERS).sort();
    expect(keys).toEqual(
      [
        "WARM_UP",
        "SWITCHING",
        "DOUBLE_PATTERN",
        "TARGET_SCORING",
        "SWITCHING_TARGET_SCORING",
        "SCORE_THRESHOLD",
        "BULLSEYE_CHECKOUT",
        "BULL_UP",
        "CHECKOUT_SEQUENCE",
        "RANDOM_CHECKOUT",
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

  it("derives the key from a resolved step", () => {
    expect(
      stepAdapterKey({
        exerciseTypeKey: "SWITCHING",
        gameRulesetVersionKey: null,
      }),
    ).toBe("SWITCHING");
    expect(
      stepAdapterKey({
        exerciseTypeKey: "GAME",
        gameRulesetVersionKey: "TUOD_V1",
      }),
    ).toBe("GAME:TUOD_V1");
  });

  it("header labels are the Phase-1 strings for the four seeded kinds", () => {
    expect(resolveStepAdapter("WARM_UP")?.headerLabel).toBe("warm up");
    expect(resolveStepAdapter("SWITCHING")?.headerLabel).toBe("switching");
    expect(resolveStepAdapter("DOUBLE_PATTERN")?.headerLabel).toBe("doubles");
    expect(resolveStepAdapter("TARGET_SCORING")?.headerLabel).toBe(
      "target scoring",
    );
    expect(resolveStepAdapter("SWITCHING_TARGET_SCORING")?.headerLabel).toBe(
      "switching target scoring",
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
        "DOUBLE_PATTERN": "Double Pattern",
        "GAME:121_V2": "121",
        "GAME:AROUND_THE_CLOCK_V2": "Around the Clock",
        "GAME:SCORE_TRAINING_V1": "Score Training",
        "GAME:TUOD_V1": "Ten Up One Down",
        "RANDOM_CHECKOUT": "Random Checkout",
        "SCORE_THRESHOLD": "65 or More",
        "SWITCHING": "Switching",
        "SWITCHING_TARGET_SCORING": "Switch Target Scoring",
        "TARGET_SCORING": "Target Scoring",
        "WARM_UP": "Warm-Up",
      }
    `);
  });
});
