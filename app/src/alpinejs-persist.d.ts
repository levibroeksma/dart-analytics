declare module '@alpinejs/persist' {
  import type { PluginCallback } from 'alpinejs';
  const plugin: PluginCallback;
  export default plugin;
  /** Runtime API exposed as `Alpine.$persist` by the plugin (no official types shipped). */
  export type Persist = <T>(initial: T) => { as(key: string): T };
}
