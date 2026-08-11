import type { Alpine } from "alpinejs";
import type { Persist } from "@alpinejs/persist";
import { authStore } from "@stores/auth.store";
import { boardInputStore } from "@stores/board-input.store";
import { gameStore } from "@stores/game.store";
import { settingsStore } from "@stores/settings.store";

export function registerStores(Alpine: Alpine) {
  Alpine.store("auth", authStore());
  Alpine.store("settings", settingsStore());
  /**
   * Alpine's `$persist` getter returns a fresh persist() per access —
   * required so each store field gets its own `.as()` alias closure.
   */
  const persist = () => (Alpine as unknown as { $persist: Persist }).$persist;
  Alpine.store("game", gameStore(persist));
  Alpine.store("boardInput", boardInputStore(persist));
}
