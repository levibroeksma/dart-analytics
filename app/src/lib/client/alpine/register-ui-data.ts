import type { Alpine } from "alpinejs";
import { logoutButton } from "@auth/logout.data";
import { toggleData } from "@lib/ui/toggle.data";
import { gameLayoutData } from "@lib/ui/game-layout.data";
import { chartData } from "@lib/ui/chart.data";
import { heatmapCanvas } from "@lib/ui/heatmap-canvas.data";
import { growingCard } from "@lib/ui/growing-card.data";
import { stepperData } from "@lib/ui/stepper.data";
import { rangeSliderData } from "@lib/ui/range-slider.data";
import { slideToStartData } from "@lib/ui/slide-to-start.data";
import { initialsOf, playerCountLabel } from "@lib/ui/initials";

export function registerUiData(Alpine: Alpine) {
  Alpine.data("logoutButton", logoutButton);
  Alpine.data("toggle", toggleData);
  Alpine.data("gameLayout", gameLayoutData);
  Alpine.data("chartData", chartData);
  Alpine.data("heatmapCanvas", heatmapCanvas);
  Alpine.data("growingCard", growingCard);
  Alpine.data("stepper", stepperData);
  Alpine.data("rangeSlider", rangeSliderData);
  Alpine.data("slideToStart", slideToStartData);
  Alpine.magic("initials", () => initialsOf);
  Alpine.magic("playerCount", () => playerCountLabel);
}
