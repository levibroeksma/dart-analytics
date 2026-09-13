import type { Alpine } from "alpinejs";
import { logoutButton } from "@auth/logout.data";
import { toggleData } from "@lib/ui/toggle.data";
import { gameLayoutData } from "@lib/ui/game-layout.data";

export function registerUiData(Alpine: Alpine) {
  Alpine.data("logoutButton", logoutButton);
  Alpine.data("toggle", toggleData);
  Alpine.data("gameLayout", gameLayoutData);
}
