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

/**
 * The keys whose object value (array, object, Map, engine) is the very same
 * reference on two instances of one factory. State a factory must create per
 * call never appears here; a shared constant does.
 */
export function sharedStateKeys(first: object, second: object): string[] {
  const other = Object.getOwnPropertyDescriptors(second);
  return Object.entries(Object.getOwnPropertyDescriptors(first))
    .filter(
      ([key, descriptor]) =>
        "value" in descriptor &&
        typeof descriptor.value === "object" &&
        descriptor.value !== null &&
        other[key]?.value === descriptor.value,
    )
    .map(([key]) => key);
}
