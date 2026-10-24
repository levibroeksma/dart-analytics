import { CricketConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createMarksCloseValidator } from "../marks-close.validator";

/** Cricket: the marks-close rules (see `createMarksCloseValidator`). */
export const cricketValidator: RulesetValidator = createMarksCloseValidator(
  "Cricket",
  CricketConfig,
);
