import { aroundTheClockValidator } from "./around-the-clock/around-the-clock.validator";
import { aroundTheClockV2Validator } from "./around-the-clock/around-the-clock.validator";
import { aroundTheClockV3Validator } from "./around-the-clock/around-the-clock.validator";
import { baseballValidator } from "./baseball/baseball.validator";
import { bobs27Validator } from "./bobs27/bobs27.validator";
import { bobs27V2Validator } from "./bobs27/bobs27.validator";
import { cricketValidator } from "./cricket/cricket.validator";
import { killerValidator } from "./killer/killer.validator";
import { followTheLeaderValidator } from "./follow-the-leader/follow-the-leader.validator";
import { doublesTrainingValidator } from "./doubles-training/doubles-training.validator";
import { tacticsValidator } from "./tactics/tactics.validator";
import { mickeyMouseValidator } from "./mickey-mouse/mickey-mouse.validator";
import { fiveOhOneValidator } from "./five-oh-one/five-oh-one.validator";
import { fiveOhOneV2Validator } from "./five-oh-one/five-oh-one.validator";
import type { RulesetValidator } from "./interfaces";
import { oneTwentyOneValidator } from "./one-twenty-one/one-twenty-one.validator";
import { oneTwentyOneV2Validator } from "./one-twenty-one/one-twenty-one.validator";
import { scoreTrainingValidator } from "./score-training/score-training.validator";
import { shanghaiValidator } from "./shanghai/shanghai.validator";
import { shanghaiV2Validator } from "./shanghai/shanghai.validator";
import { shanghaiV3Validator } from "./shanghai/shanghai.validator";
import { singlesTrainingValidator } from "./singles-training/singles-training.validator";
import { singlesTrainingV2Validator } from "./singles-training/singles-training.validator";
import { singlesTrainingV3Validator } from "./singles-training/singles-training.validator";
import { tuodValidator } from "./tuod/tuod.validator";

const REGISTRY: Record<string, RulesetValidator> = {
  SCORE_TRAINING_V1: scoreTrainingValidator,
  BOBS27_V1: bobs27Validator,
  BOBS27_V2: bobs27V2Validator,
  SINGLES_V1: singlesTrainingValidator,
  SINGLES_V2: singlesTrainingV2Validator,
  SINGLES_V3: singlesTrainingV3Validator,
  DOUBLES_TRAINING_V1: doublesTrainingValidator,
  "501_V1": fiveOhOneValidator,
  "501_V2": fiveOhOneV2Validator,
  TUOD_V1: tuodValidator,
  SHANGHAI_V1: shanghaiValidator,
  SHANGHAI_V2: shanghaiV2Validator,
  SHANGHAI_V3: shanghaiV3Validator,
  "121_V1": oneTwentyOneValidator,
  "121_V2": oneTwentyOneV2Validator,
  AROUND_THE_CLOCK_V1: aroundTheClockValidator,
  AROUND_THE_CLOCK_V2: aroundTheClockV2Validator,
  AROUND_THE_CLOCK_V3: aroundTheClockV3Validator,
  CRICKET_V1: cricketValidator,
  CRICKET_V2: cricketValidator,
  TACTICS_V1: tacticsValidator,
  TACTICS_V2: tacticsValidator,
  MICKEY_MOUSE_V1: mickeyMouseValidator,
  BASEBALL_V1: baseballValidator,
  KILLER_V1: killerValidator,
  FOLLOW_THE_LEADER_V1: followTheLeaderValidator,
};

export function getRulesetValidator(
  rulesetVersionKey: string,
): RulesetValidator | undefined {
  return REGISTRY[rulesetVersionKey];
}
