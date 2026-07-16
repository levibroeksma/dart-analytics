'use strict';

// Plugins
import persist from '@alpinejs/persist';

// Types
import type { Alpine } from 'alpinejs';

// Register
import { registerStores } from './register-stores';
import { registerRouteData } from './register-route-data';
import { registerUiData } from './register-ui-data';

export default (Alpine: Alpine) => {
  // Plugins
  Alpine.plugin(persist);

  // Stores
  registerStores(Alpine);

  // Route Data
  registerRouteData(Alpine);

  // UI Data
  registerUiData(Alpine);
};
