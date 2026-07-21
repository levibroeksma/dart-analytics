declare module "@alpinejs/persist" {
  import type { PluginCallback } from "alpinejs";
  const plugin: PluginCallback;
  export default plugin;
  /**
   * One `persist()` closure from Alpine.`$persist`. Each closure shares a single
   * `.as()` alias — never reuse one instance across multiple store fields.
   */
  export type Persist = <T>(initial: T) => { as(key: string): T };
  /**
   * Factory matching Alpine.`$persist` getter semantics: each call returns a
   * fresh `persist()` with its own alias closure.
   */
  export type PersistFactory = () => Persist;
}
