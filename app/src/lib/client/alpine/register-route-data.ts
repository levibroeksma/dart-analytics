import type { Alpine } from "alpinejs";
import { loginForm } from "@auth/login.data";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";
import { fiveOhOnePlay } from "@lib/game/five-oh-one-play.data";
import { bobs27Setup } from "@lib/game/bobs27-setup.data";
import { bobs27Play } from "@lib/game/bobs27-play.data";
import { gamesIndex } from "@lib/game/games-index.data";

export function registerRouteData(Alpine: Alpine) {
  Alpine.data("loginForm", loginForm);
  Alpine.data("gamesIndex", gamesIndex);
  Alpine.data("scoreTrainingSetup", scoreTrainingSetup);
  Alpine.data("scoreTrainingPlay", scoreTrainingPlay);
  Alpine.data("fiveOhOneSetup", fiveOhOneSetup);
  Alpine.data("fiveOhOnePlay", fiveOhOnePlay);
  Alpine.data("bobs27Setup", bobs27Setup);
  Alpine.data("bobs27Play", bobs27Play);
}
