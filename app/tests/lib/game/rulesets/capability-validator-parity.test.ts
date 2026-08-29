import { describe, expect, it } from "vitest";
import { RULESET_CAPABILITIES } from "@lib/game/rulesets/capabilities";
import type { RulesetVersionKey } from "@lib/types";
import { getRulesetValidator } from "@services/rulesets/registry";

/**
 * Every capture mode and input mode a session can name. The undeclared cases
 * below are the cross product minus what a ruleset declares, so a new mode pair
 * is covered here the moment it is seeded rather than needing a new test.
 */
const CAPTURE_MODES = ["RECREATIONAL", "ANALYTICS"] as const;
const INPUT_MODES = ["QUICK_SCORE", "DETAILED_DARTS", "VISUAL_BOARD"] as const;

/**
 * Every `validateConfig` names the pairs it accepts with this phrase when it
 * refuses on mode grounds — verified across all six validators. A rejection
 * carrying it is a mode refusal; any other rejection is the config schema
 * talking, which is a different thing entirely.
 */
const MODE_REJECTION = "only supports";

const rulesetKeys = Object.keys(RULESET_CAPABILITIES) as RulesetVersionKey[];

function rejectsOnMode(
  rulesetVersionKey: RulesetVersionKey,
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  const validator = getRulesetValidator(rulesetVersionKey);
  if (!validator) throw new Error(`no validator for ${rulesetVersionKey}`);

  const result = validator.validateConfig({
    config: {},
    captureModeKey,
    inputModeKey,
  });
  if (result.valid) return false;

  const issues: unknown[] = Array.isArray(result.issues) ? result.issues : [];
  return issues.some(
    (issue): boolean =>
      typeof issue === "string" && issue.includes(MODE_REJECTION),
  );
}

function declaredPairs(rulesetVersionKey: RulesetVersionKey): string[] {
  return RULESET_CAPABILITIES[rulesetVersionKey].map(
    (pair) => `${pair.captureModeKey}|${pair.inputModeKey}`,
  );
}

function undeclaredPairs(rulesetVersionKey: RulesetVersionKey): string[] {
  const declared = new Set(declaredPairs(rulesetVersionKey));
  const pairs: string[] = [];

  for (const captureModeKey of CAPTURE_MODES) {
    for (const inputModeKey of INPUT_MODES) {
      const pair = `${captureModeKey}|${inputModeKey}`;
      if (!declared.has(pair)) pairs.push(pair);
    }
  }

  return pairs;
}

/**
 * `RULESET_CAPABILITIES` states which mode pairs a ruleset supports; each
 * ruleset's `validateConfig` independently enforces the same thing at session
 * creation. Nothing else compares them, and they have already drifted once:
 * 501 and Score Training declared `ANALYTICS + VISUAL_BOARD` while their
 * `validateConfig` still refused it, so the capture path this branch exists to
 * open could not be entered. These tests are that missing seam.
 *
 * The two are deliberately NOT wired to each other in production — the constant
 * is what the system claims, the validator is what a ruleset implements, and
 * collapsing them would destroy the cross-check. Proving they agree is the
 * test's job, not the code's.
 */
describe("capability constant and ruleset validators agree", () => {
  it("covers every ruleset", () => {
    expect(rulesetKeys.length).toBe(12);
  });

  it.each(rulesetKeys)("%s accepts every pair it declares", (rulesetKey) => {
    const declared = RULESET_CAPABILITIES[rulesetKey];
    expect(declared.length).toBeGreaterThan(0);

    for (const pair of declared) {
      expect(
        rejectsOnMode(rulesetKey, pair.captureModeKey, pair.inputModeKey),
        `${rulesetKey} declares ${pair.captureModeKey} + ${pair.inputModeKey} but its validateConfig refuses it`,
      ).toBe(false);
    }
  });

  it.each(rulesetKeys)(
    "%s refuses every pair it does not declare",
    (rulesetKey) => {
      const undeclared = undeclaredPairs(rulesetKey);
      expect(undeclared.length).toBeGreaterThan(0);

      for (const pair of undeclared) {
        const [captureModeKey, inputModeKey] = pair.split("|") as [
          string,
          string,
        ];
        expect(
          rejectsOnMode(rulesetKey, captureModeKey, inputModeKey),
          `${rulesetKey} does not declare ${captureModeKey} + ${inputModeKey} but its validateConfig accepts it`,
        ).toBe(true);
      }
    },
  );
});
