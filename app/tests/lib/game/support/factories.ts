import { aroundTheClockPlay } from "@lib/game/around-the-clock-play.data";
import { aroundTheClockSetup } from "@lib/game/around-the-clock-setup.data";
import { baseballPlay } from "@lib/game/baseball-play.data";
import { baseballSetup } from "@lib/game/baseball-setup.data";
import { bobs27Play } from "@lib/game/bobs27-play.data";
import { bobs27Setup } from "@lib/game/bobs27-setup.data";
import { cricketPlay } from "@lib/game/cricket-play.data";
import { cricketSetup } from "@lib/game/cricket-setup.data";
import { doublesTrainingPlay } from "@lib/game/doubles-training-play.data";
import { doublesTrainingSetup } from "@lib/game/doubles-training-setup.data";
import { fiveOhOnePlay } from "@lib/game/five-oh-one-play.data";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";
import { followTheLeaderPlay } from "@lib/game/follow-the-leader-play.data";
import { followTheLeaderSetup } from "@lib/game/follow-the-leader-setup.data";
import { killerPlay } from "@lib/game/killer-play.data";
import { killerSetup } from "@lib/game/killer-setup.data";
import { oneTwentyOnePlay } from "@lib/game/one-twenty-one-play.data";
import { oneTwentyOneSetup } from "@lib/game/one-twenty-one-setup.data";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";
import { shanghaiPlay } from "@lib/game/shanghai-play.data";
import { shanghaiSetup } from "@lib/game/shanghai-setup.data";
import { singlesTrainingPlay } from "@lib/game/singles-training-play.data";
import { singlesTrainingSetup } from "@lib/game/singles-training-setup.data";
import { tacticsPlay } from "@lib/game/tactics-play.data";
import { tacticsSetup } from "@lib/game/tactics-setup.data";
import { tuodPlay } from "@lib/game/tuod-play.data";
import { tuodSetup } from "@lib/game/tuod-setup.data";
import { quickSubtractPlay } from "@lib/training/trivia/quick-subtract-play.data";
import { routinePlay } from "@lib/training/routines/routine-play.data";

/** Every Alpine `x-data` factory a game/trivia/routine page binds. Keyed by the name the page calls. */
export const FACTORIES: Record<string, () => object> = {
  aroundTheClockPlay,
  aroundTheClockSetup,
  baseballPlay,
  baseballSetup,
  bobs27Play,
  bobs27Setup,
  cricketPlay,
  cricketSetup,
  doublesTrainingPlay,
  doublesTrainingSetup,
  fiveOhOnePlay,
  fiveOhOneSetup,
  followTheLeaderPlay,
  followTheLeaderSetup,
  killerPlay,
  killerSetup,
  oneTwentyOnePlay,
  oneTwentyOneSetup,
  scoreTrainingPlay,
  scoreTrainingSetup,
  shanghaiPlay,
  shanghaiSetup,
  singlesTrainingPlay,
  singlesTrainingSetup,
  tacticsPlay,
  tacticsSetup,
  tuodPlay,
  tuodSetup,
  quickSubtractPlay,
  routinePlay,
};
