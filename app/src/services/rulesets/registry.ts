import { aroundTheClockValidator } from "./around-the-clock/around-the-clock.validator";
import { bobs27Validator } from "./bobs27/bobs27.validator";
import { doublesTrainingValidator } from "./doubles-training/doubles-training.validator";
import { fiveOhOneValidator } from "./five-oh-one/five-oh-one.validator";
import type { RulesetValidator } from "./interfaces";
import { oneTwentyOneValidator } from "./one-twenty-one/one-twenty-one.validator";
import { oneTwentyOneV2Validator } from "./one-twenty-one/one-twenty-one.validator";
import { scoreTrainingValidator } from "./score-training/score-training.validator";
import { shanghaiValidator } from "./shanghai/shanghai.validator";
import { shanghaiV2Validator } from "./shanghai/shanghai.validator";
import { singlesTrainingValidator } from "./singles-training/singles-training.validator";
import { tuodValidator } from "./tuod/tuod.validator";

const REGISTRY: Record<string, RulesetValidator> = {
  SCORE_TRAINING_V1: scoreTrainingValidator,
  BOBS27_V1: bobs27Validator,
  SINGLES_V1: singlesTrainingValidator,
  DOUBLES_TRAINING_V1: doublesTrainingValidator,
  "501_V1": fiveOhOneValidator,
  TUOD_V1: tuodValidator,
  SHANGHAI_V1: shanghaiValidator,
  SHANGHAI_V2: shanghaiV2Validator,
  "121_V1": oneTwentyOneValidator,
  "121_V2": oneTwentyOneV2Validator,
  AROUND_THE_CLOCK_V1: aroundTheClockValidator,
};

export function getRulesetValidator(
  rulesetVersionKey: string,
): RulesetValidator | undefined {
  return REGISTRY[rulesetVersionKey];
}
