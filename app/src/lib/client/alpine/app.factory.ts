"use strict";

import persist from "@alpinejs/persist";
import collapse from "@alpinejs/collapse";

import type { Alpine } from "alpinejs";

import { registerStores } from "./register-stores";
import { registerRouteData } from "./register-route-data";
import { registerUiData } from "./register-ui-data";

export default (Alpine: Alpine) => {
  Alpine.plugin(persist);
  Alpine.plugin(collapse);
  registerStores(Alpine);
  registerRouteData(Alpine);
  registerUiData(Alpine);
};
