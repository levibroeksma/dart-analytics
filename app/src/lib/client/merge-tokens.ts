/**
 * Brand `@theme` tokens tailwind-merge cannot classify unaided, keyed by
 * their global.css namespace (`--text-hero` → `text: ["hero"]`). Unknown
 * names default to colours, so an unlisted token loses to `text-foreground`
 * or `shadow-sky-500`. cn.test.ts fails until this matches global.css.
 */
export const MERGE_TOKENS = {
  text: [
    "hero",
    "title",
    "value",
    "tile",
    "card-title",
    "control",
    "eyebrow",
    "eyebrow-lg",
    "eyebrow-sm",
    "body-sm",
    "caption",
    "micro",
    "key",
    "key-label",
    "stat",
    "summary",
    "summary-lg",
    "numeral-1",
    "numeral-2",
    "numeral-3",
    "numeral-4",
    "numeral-5",
    "numeral-6",
  ],
  radius: [
    "sm",
    "md",
    "lg",
    "xl",
    "2xl",
    "row",
    "key",
    "switch",
    "board",
    "sheet",
    "tab",
    "tab-pill",
  ],
  shadow: ["card", "magnifier"],
  "text-shadow": ["hero", "glow"],
  spacing: ["hit"],
  animate: [
    "sheet-in",
    "deck-out",
    "deck-rise",
    "deck-in",
    "deck-fade-out",
    "deck-fade-rise",
    "deck-fade-in",
  ],
  "grid-template-columns": ["mirror", "scoreboard"],
  "background-image": [
    "blue-glass",
    "tab-card",
    "tab-active",
    "tab-active-ring",
  ],
} as const;

/** `@theme` namespaces tailwind-merge classifies unaided: any name is a colour or font family. */
export const SELF_MERGING: readonly string[] = ["color", "font"];

/**
 * Every global.css `@utility` → the tailwind-merge class group it overrides,
 * so `cn("pt-2", "pt-safe")` keeps only `pt-safe`. `null` composes freely
 * with every stock class. cn.test.ts fails until this matches global.css.
 */
export const UTILITY_GROUPS: Readonly<Record<string, string | null>> = {
  glass: null,
  "glass-tinted": null,
  "glass-raised": null,
  "glass-tinted-raised": null,
  "glass-button": null,
  "glass-blue": null,
  "glass-info": null,
  "inset-well": null,
  "inset-well-muted": null,
  "glass-sheet": null,
  "setting-badge": null,
  "slider-fill": null,
  "slider-thumb": null,
  "slider-bubble": null,
  "slide-thumb": null,
  "slide-fill": null,
  "start-bar-fade": null,
  "stack-slab-1": "stack-slab",
  "stack-slab-2": "stack-slab",
  "border-medium": "border-w",
  "pt-safe": "pt",
  "pb-safe": "pb",
  "bottom-nav": "bottom",
  "bottom-above-nav": "bottom",
  "pb-nav": "pb",
  "input-number-plain": null,
  "glass-active-seat": null,
  "input-well": null,
  "key-press": null,
  "next-dart-ring": null,
  "target-key-ring": null,
  "pip-on": null,
  "board-dim": null,
  "glass-pill": null,
};
