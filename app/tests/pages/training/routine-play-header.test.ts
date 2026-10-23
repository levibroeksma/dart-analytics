import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A countdown game's pause pill lives in `GameLayout`'s `header-end` slot
 * (D432). The routine page must place a game step's pill there too, not in
 * a body row above the game, so a routine step shows its timer where the
 * same game played standalone does (#846). Every step type shares that one
 * pill: the page scope's `pausable()`/`paused()`/`togglePause()` delegate a
 * game step to its own pause (D483).
 */

const routinePage = readFileSync(
  fileURLToPath(
    new URL(
      "../../../src/pages/training/routines/play/index.astro",
      import.meta.url,
    ),
  ),
  "utf8",
);

const pillTags = [...routinePage.matchAll(/<CountdownPauseControl\b[^>]*>/g)];

describe("routine play countdown pill", () => {
  it("renders exactly one pause pill", () => {
    expect(pillTags).toHaveLength(1);
  });

  it("places the pill in the header-end slot", () => {
    expect(pillTags[0]?.[0]).toContain('slot="header-end"');
  });

  it("reads pause state through the page scope, not a nested x-data", () => {
    const pill = pillTags[0]?.[0] ?? "";
    expect(pill).toContain('pausedExpr="paused()"');
    expect(pill).toContain('showExpr="pausable()"');
    expect(pill).toContain('toggleExpr="togglePause()"');
    expect(pill).not.toContain("scopeExpr");
  });
});
