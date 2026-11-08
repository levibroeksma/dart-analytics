import type { ZodTypeAny } from "zod";
import type { ExistingTurnCounts } from "@repositories/interfaces";
import type { EventsBatchRequestInput } from "@routes/types";

export type ConfigValidationResult =
  | { valid: true; config: Record<string, unknown> }
  | { valid: false; issues: unknown };

export type BatchValidationResult =
  | { valid: true }
  | {
      valid: false;
      code:
        | "VALIDATION_FAILED"
        | "BATCH_INCONSISTENT_ORDERING"
        | "BATCH_REFERENCE_MISSING";
      issues?: unknown;
    };

/**
 * What `RulesetValidator.validateBatch` receives. `captureModeKey`/
 * `inputModeKey` are optional because most rulesets support exactly one mode
 * pair and never branch on it in `validateBatch` — only a ruleset that
 * supports more than one pair (501, Score Training) needs them to pick
 * between a coordinate validator and a visit-total one.
 */
export type BatchValidationInput = {
  config: Record<string, unknown>;
  batch: EventsBatchRequestInput;
  existingTurnCounts: ExistingTurnCounts;
  captureModeKey?: string;
  inputModeKey?: string;
};

/** `BatchValidationInput` for a ruleset that branches on its mode pair. */
export type ModedBatchValidationInput = BatchValidationInput & {
  captureModeKey: string;
  inputModeKey: string;
};

/**
 * What `createThreeDartValidator` needs to know about one ruleset. Three
 * fields, because measurement found exactly three things the five three-dart
 * validators differ in: the Zod config schema, the game's name in the
 * mode-pair rejection, and the dartless-turn message.
 *
 * `dartlessIssue` is required rather than defaulted on purpose. The five ship
 * three distinct message bodies — Around the Clock names the two supported
 * mode pairs (a BULL hit can end a visit before three darts), Doubles
 * Training says "carries at least one dart", the rest say "is exactly 3
 * darts" — and these strings cross the API boundary to the client, so a
 * default would silently reword two of them.
 */
export type ThreeDartValidatorOptions = {
  label: string;
  configSchema: ZodTypeAny;
  dartlessIssue: (clientKey: string) => string;
};

/**
 * How a round-based game's closed visit total relates to its darts: returns
 * `null` when `totalScore` is acceptable for the turn thrown in `round`
 * (1-based, counted per participant), else why it is not.
 */
export type RoundTotalRule = (
  turn: EventsBatchRequestInput["stages"][number]["turns"][number],
  round: number,
  config: Record<string, unknown>,
) => string | null;

/**
 * What `validateScoredBatch` needs to know about one visit-total ruleset:
 * the highest total one turn may carry and the noun the ROUNDS-cap rejection
 * names.
 */
export type ScoredBatchOptions = {
  maxTurnScore: number;
  limitNoun: "visits" | "attempts";
};
