import type { Alpine } from 'alpinejs';
import { loginForm } from '@auth/login.data';
import { scoreTrainingSetup } from '@lib/game/score-training-setup.data';
import { scoreTrainingPlay } from '@lib/game/score-training-play.data';

export function registerRouteData(Alpine: Alpine) {
  Alpine.data('loginForm', loginForm);
  Alpine.data('scoreTrainingSetup', scoreTrainingSetup);
  Alpine.data('scoreTrainingPlay', scoreTrainingPlay);
}
