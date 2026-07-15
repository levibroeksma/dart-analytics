import type { Alpine } from 'alpinejs';
import { authStore } from '@stores/auth.store';

export function registerStores(Alpine: Alpine) {
  Alpine.store('auth', authStore());
}
