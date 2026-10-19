/** Whether the user asked the OS for reduced motion; false without `matchMedia`. */
export function prefersReducedMotion(): boolean {
  return (
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ??
    false
  );
}
