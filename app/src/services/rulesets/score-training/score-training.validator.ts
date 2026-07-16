import type { RulesetValidator } from "../interfaces";

export const scoreTrainingValidator: RulesetValidator = {
  validateConfig: () => ({ valid: false, issues: ["not implemented"] }),
  validateBatch: () => ({ valid: false, code: "VALIDATION_FAILED" }),
};
