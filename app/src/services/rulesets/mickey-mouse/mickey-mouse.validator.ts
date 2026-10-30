import { MickeyMouseConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createMarksCloseValidator } from "../marks-close.validator";

/** Mickey Mouse: the marks-close rules (see `createMarksCloseValidator`). */
export const mickeyMouseValidator: RulesetValidator = createMarksCloseValidator(
  "Mickey Mouse",
  MickeyMouseConfig,
);
