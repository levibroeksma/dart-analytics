'use strict';

import persist from '@alpinejs/persist';
import type { Alpine } from 'alpinejs';
import { registerStores } from './register-stores';
import { registerUiData } from './register-ui-data';
import { registerRouteData } from './register-route-data';

export default (Alpine: Alpine) => {
  Alpine.plugin(persist);
  registerStores(Alpine);
  registerUiData(Alpine);
  registerRouteData(Alpine);
};
