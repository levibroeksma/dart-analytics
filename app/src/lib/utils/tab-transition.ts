import type { TabRevealEventLike } from "./types";

/**
 * `pagereveal` handler: tags the view transition `forward`/`back` by tab
 * order against the previous tab in `storage` (`da:tab`), else skips it.
 * Inlined into a render-blocking `<head>` script via `toString()`, so it
 * must not reference any module binding (D418).
 */
export function onTabReveal(
  event: TabRevealEventLike,
  storage: Pick<Storage, "getItem" | "setItem">,
): void {
  const raw = document.documentElement.dataset.tab;
  const current = raw == null ? NaN : Number.parseInt(raw, 10);
  let previous = NaN;
  try {
    const stored = storage.getItem("da:tab");
    if (stored != null) previous = Number.parseInt(stored, 10);
  } catch {
    previous = NaN;
  }
  if (!Number.isNaN(current)) {
    try {
      storage.setItem("da:tab", String(current));
    } catch {
      previous = NaN;
    }
  }
  const transition = event.viewTransition;
  if (transition == null) return;
  if (Number.isNaN(current) || Number.isNaN(previous) || current === previous) {
    transition.skipTransition();
    return;
  }
  transition.types.add(current > previous ? "forward" : "back");
}
