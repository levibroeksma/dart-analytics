import { TacticsConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createMarksCloseValidator } from "../marks-close.validator";

/** Tactics: the marks-close rules (see `createMarksCloseValidator`). */
export const tacticsValidator: RulesetValidator = createMarksCloseValidator(
  "Tactics",
  TacticsConfig,
);
