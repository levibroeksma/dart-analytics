import type { Alpine } from 'alpinejs';
import { logoutButton } from '@auth/logout.data';

export function registerUiData(Alpine: Alpine) {
  Alpine.data('logoutButton', logoutButton);
}
