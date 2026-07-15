import type { Alpine } from 'alpinejs';
import { logoutButton } from '@components/ui/logout.data';

export function registerUiData(Alpine: Alpine) {
  Alpine.data('logoutButton', logoutButton);
}
