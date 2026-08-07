import type { Alpine } from "alpinejs";
import { logoutButton } from "@auth/logout.data";
import { toggleData } from "@lib/ui/toggle.data";

export function registerUiData(Alpine: Alpine) {
  Alpine.data("logoutButton", logoutButton);
  Alpine.data("toggle", toggleData);
}
