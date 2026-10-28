import { KillerConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

const SEATS = 2;

const threeDartValidator = createThreeDartValidator({
  label: "Killer",
  configSchema: KillerConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Killer visit is up to 3 darts, never a dartless total`,
});

/** The seat-number rule V1's fixed two seats add, or null when it holds. */
function seatNumbersIssue(numbers: readonly number[]): string | null {
  if (numbers.length !== SEATS)
    return `Killer needs one number per seat (${SEATS})`;
  return new Set(numbers).size === numbers.length
    ? null
    : "Seat numbers must differ";
}

/**
 * Killer: the shared three-dart rules, plus one distinct number per seat.
 * A visit's `totalScore` stays its darts' board-score sum.
 */
export const killerValidator: RulesetValidator = {
  ...threeDartValidator,
  validateConfig(input) {
    const result = threeDartValidator.validateConfig(input);
    if (!result.valid) return result;
    const issue = seatNumbersIssue(
      result.config.seat_numbers as readonly number[],
    );
    return issue === null ? result : { valid: false, issues: [issue] };
  },
};
