import { parseEnv } from "@neon/env";
import config from "../../neon";

type Env = ReturnType<typeof parseEnv<typeof config>>;

let cached: Env | undefined;

/**
 * Astro's static build executes route/middleware modules to prerender pages,
 * where no Neon runtime vars are present (those are Worker-only secrets).
 * Deferring `parseEnv` to first property access keeps prerendering from
 * throwing for pages that merely import a module in this chain without ever
 * needing env at build time.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop, receiver) {
    cached ??= parseEnv(config);
    return Reflect.get(cached, prop, receiver);
  },
});
