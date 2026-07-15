import type { Alpine } from 'alpinejs';
import { loginForm } from '@pages/login/login.data';

export function registerRouteData(Alpine: Alpine) {
  Alpine.data('loginForm', loginForm);
}
