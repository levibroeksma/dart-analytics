/**
 * The key shape of an object a factory returned: its own keys in creation
 * order, a method suffixed `()`, an accessor suffixed ` get`. Reads property
 * descriptors, so a getter is never invoked.
 */
export function shapeOf(value: object): string[] {
  return Object.entries(Object.getOwnPropertyDescriptors(value)).map(
    ([key, descriptor]) => {
      if (descriptor.get || descriptor.set) return `${key} get`;
      return typeof descriptor.value === "function" ? `${key}()` : key;
    },
  );
}
