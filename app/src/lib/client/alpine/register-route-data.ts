import type { Alpine } from 'alpinejs';
import { loginForm } from '@auth/login.data';

export function registerRouteData(Alpine: Alpine) {
  Alpine.data('loginForm', loginForm);
}
