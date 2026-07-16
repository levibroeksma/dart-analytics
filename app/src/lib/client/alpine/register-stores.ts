import type { Alpine } from 'alpinejs';
import type { Persist } from '@alpinejs/persist';
import { authStore } from '@stores/auth.store';
import { gameStore } from '@stores/game.store';

export function registerStores(Alpine: Alpine) {
  Alpine.store('auth', authStore());
  const persist = (Alpine as unknown as { $persist: Persist }).$persist;
  Alpine.store('game', gameStore(persist));
}
