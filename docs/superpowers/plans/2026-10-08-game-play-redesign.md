# Game Play Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every `/games/*/play` screen to the Claude Design game-play screens, in Recreational (keypad / tap) and Analytics (board) mode, by changing the shared shells and input panels once so all 11 games inherit it.

**Architecture:** Three layers, bottom up.
- **Data:** each play factory gains a tested `subtitle()` plus the few getters the design needs. Pure display helpers live in `lib/ui/play-display.ts` and `lib/game/play-subtitle.ts`, and reach markup as Alpine magics (the `$initials` precedent, D430).
- **Shells:** `GameLayout` gets the glass header pill. Each page's play `x-data` moves onto `<GameLayout>`, so header expressions (`subtitle()`, the countdown pill) resolve in the play scope. `SinglePlayerDisplay`, `SplitScoreboard(Half)` and `VisitPreview` are rebuilt, with four small new components (`PlayStatTile`, `LegBars`, `RouteChips`, `MarkRows`).
- **Inputs:** `InputButton` becomes the inset key (`key-press`). Every panel sits in `input-well`. The board dims while pressed, and the magnifier shows its read inside the circle.

**Tech Stack:** Astro 5, Alpine.js 3.15, Tailwind v4 (`@utility` in `app/src/styles/global.css`), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-game-play-redesign-design.md`

## Global Constraints

- **Branch and commits.**
  - Branch: `feat/game-play-redesign`, already checked out.
  - Commit once per task. Every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Decision id.** The branch is rebased onto `origin/main`, which already contains login #836 (D431). This work is **D432**. If `main` gains another decision before this lands, renumber with `bash scripts/renumber-decision.sh`; never hand-edit the id.
- **Out of scope:** any engine, ruleset, config or API change.
- **Removals (user decision, 2026-10-08).** Each subject is deleted together with its tests (root CLAUDE.md test-removal rule):
  - `magnifierLabelStyle`, with its constant and its factory method (spec §7, Task 10)
  - the five getters that lose their last markup caller: `matchTitle` (Task 7), and `hitsNeededLabel`, `attemptLabel`, `durationType` and `dartsThrownThisSession` (Task 8)
- **Icons:** no new files. Use `@icons/exit.svg`, `pause.svg`, `undo.svg`, `delete.svg`, `check.svg`, `cross.svg` and `play-solid.svg`, coloured through `currentColor`.
- **Board:** the existing SVG `DartBoard.astro`. Analytics mode shows the board alone, with no keypad (D201).
- **Values come from data**, never from the design's sample numbers.
  - Header titles, verbatim: `501`, `121`, `Around the Clock`, `Bob's 27`, `Doubles`, `Score training`, `Shanghai`, `Singles`, `Ten Up One Down`, `Cricket`, `Tactics`.
  - Subtitle wording is the spec §8 table.
- **Tokens only.**
  - No coloured palette utilities (`sky-*`, `zinc-*`) and no raw `oklch` in markup.
  - White/black alpha utilities only where the spec names them: `border-white/8`, `bg-white/22`, `bg-white/12`, `ring-white/25`, `bg-black/60`. This follows the Modal grabber precedent.
  - The spec's "black/45" wells snap to `inset-well`.
- **Radii.** `rounded-3xl` is Tailwind's 24px. In this repo `rounded-2xl` is **20px** and `rounded-xl` is **16px** (`@theme`), so use `rounded-xl` wherever the spec says 16px. The 22px, 17px and 14px radii are arbitrary values (`rounded-[22px]` and so on).
- **One surface utility per element.** Never put two of `inset-well`, `inset-well-muted`, `glass-blue`, `next-dart-ring`, `target-key-ring` or `pip-on` on the same element.
  - All of them set `background` and/or `box-shadow`.
  - Cascade order between custom utilities is not something to rely on, so swap them with a ternary.
- **Component rules** (existing gates):
  - `cn()` for build-time classes
  - `{...props}`, never `{...rest}`
  - every `x-show` pairs with `x-cloak`
  - no `x-init`, no HTML comments, no `//` inside function bodies
  - a JSDoc header on every component and exported function
  - Alpine shorthand
  - no important modifier and no `-prop-[…]`
- **`loading`.** Every play factory defines `loading`, and `Button` reads it by default. So `Button`s that now sit in the play scope (header exit, pause pill, resume) pass `loadingExpr="false"`.
- **Testing.**
  - `.astro` markup is not unit-tested (D101). Helpers and getters are tested, and CSS is pinned in `brand-tokens.test.ts`.
  - The visual check is handed to the user: no headless browser is available in this sandbox.
- **fallow health** thresholds apply to `.astro` too (`app/.fallowrc.jsonc`). If a component breaches them, simplify it. Never add a threshold override without the user's OK.
- **Commands** run from `app/` unless shown with `../scripts/…`.
  - One file: `npm test -- <path>`. Full suite: `npm test`.
  - Types: `npx astro check --minimumFailingSeverity hint`, which must report 0/0/0.

## Plan-time amendments to the spec

1. **Header scope.** `GameLayout`'s header renders outside the page's `x-data` div. As specced, `gameSubtitleExpr="subtitle()"` and a pause pill in `header-end` would run in `gameLayout()`'s scope and throw. 501's current `gameTitleExpr="matchTitle()"` already has this problem.
   - **Fix:** `GameLayout` forwards leftover attributes onto a wrapper around the header and `<main>`. Each play page moves `x-data="<game>Play()"` and `@confirm-exit.window` from its inner div onto `<GameLayout>`.
   - `check-game-wiring.sh` still finds the page's `x-data`.
   - `header-end` sits in a `min-w-11` box. That box is the 44px spacer, including when the pill inside it is hidden (ROUNDS sessions).
2. **Pause pill visibility** adds `hasActiveSession && !finished`. The interface wrapper used to supply both by being hidden, so the pill's effective rule is unchanged.
3. **Helpers in markup.** The `play-display` helpers reach markup as Alpine magics (`$bigValueSize`, `$seatValueSize`, `$legBarStates`, `$previewColumnState`, `$ringKeyActive`), registered in `register-ui-data.ts` like `$initials`.
4. **`seatValueSize` (new).** At a fixed 64px, a 4+ character score (`BULL`, `1,234`) overflows the active card's 1.3fr column. So the active card steps 64 → 46px from 4 characters.
5. **Three more small components.**
   - `RouteChips.astro`: used by the solo card and the active seat card.
   - `MarkRows.astro`: shared by Cricket and Tactics.
   - `PlayStatTile` gains `compact` for the active card's 44px rows, instead of a fourth component.
6. **`InputButton` props.** It gets `variant: "well" | "muted" | "target"` (spec: `muted`) and `pressedExpr` (`glass-blue` ring key), so that each state picks exactly one surface utility.
7. **Two more utilities.**
   - `target-key-ring`: `next-dart-ring` without the glow, for the doubles target key.
   - `pip-on`: the lit mark pip with its glow.
   - `next-dart-ring` and `target-key-ring` carry the well background themselves, so they replace `inset-well` rather than stack on it.
8. **Pip and leg-bar wells.** The spec's "black/45" wells for open leg bars and pips snap to `inset-well` (black/35). No new token.
9. **`PlayStatTile` radius** is `rounded-xl` (16px here; see Global Constraints).
10. **Board markers** already are 12px accent dots with a 2px `--surface` rim (`size-3 border-2 border-surface bg-accent`), so they stay unchanged.
11. **Pause pill and resume button** render through `Button` (components rule).
    - Pause pill: `sheet-muted`, which is `inset-well-muted`, not `inset-well`.
    - Resume: `sheet-raised`, which is `glass-button`.
12. **New `For` getters (spec §8 rule).**
    - 121 gets `checkoutHintFor`. `checkoutHint` now delegates to it, and the private `dartsLeftInOpenVisit` is replaced by the shared `dartsLeftForSeat`.
    - Also: `dartsThisAttemptFor`, Around the Clock's `hitsToGoFor`, and TUOD's `attemptsFor` / `successFailureFor`, each with its active-seat form.
13. **Orphaned getters are deleted (user decision).** `matchTitle`, `hitsNeededLabel`, `attemptLabel`, `durationType` and `dartsThrownThisSession` lose their last markup caller in this PR. Each one goes, together with its tests, in the task that removes that caller (Tasks 7 and 8). The removal is recorded in D432.
14. **`GameLayout` has no Component Inventory row today.** One is added (spec: "updated rows").
15. **Doubles split.** The split card's value becomes `currentTargetLabelFor` (was `hitCountFor`), so the solo and split cards show the same value. Hits move to the idle stat.
16. **Play-area padding.** It moves into `GameLayout` (`px-4 pt-1.5 pb-7.5`). The 11 play pages drop their `p-3`. The routine play and Quick Subtract pages drop theirs too (an adjacent edit), so their inset does not double.
17. **Round caps.** Rounds-based subtitles cap at their budget, so a completed session never reads `ROUND 22 OF 21`:
    - Bob's 27 and Shanghai cap at the path length.
    - Score training ROUNDS caps at `durationValue`.

## Review Focus

1. **Header before a session loads.** On the no-session, reconciliation and reload paths, the config is null while the header still renders. Every `subtitle()` must return `""` and must not throw. This is pinned by each factory's "blank before config loads" test (Tasks 4–6).
2. **Long big values.** `BULL`, `1,234`, a 4-digit active seat score and Quick Subtract's equation must fit their column. This is pinned by the `bigValueSize` / `seatValueSize` length tables (Task 2), and checked visually in Task 11.
3. **Leg target unknown or above 5.**
   - Before config loads, no bars render.
   - Above 5 legs, a `won/target` counter shows instead of bars.
   - A seat never paints more won bars than legs to win.
   - These are pinned by the `legBarStates(0, 0)`, `(0, 6)` and `(4, 3)` tests (Task 2).
4. **The waiting seat in 1v1 reads its own state.** It must not read the throwing seat's state. This is pinned by:
   - `checkoutHintFor(p2)` returning the full 3-dart route while p1 is mid-visit
   - `dartsThisAttemptFor(p2) === 0`
   - `attemptsFor(p2) === 0` (Task 4)
   - `hitsToGoFor` (Task 5)
5. **Ring keys.** S lights when no D or T is armed, and D or T lights when armed. This is pinned by the `ringKeyActive` table (Task 2). BULL disabled under T is markup, checked in Task 11.

---

### Task 1: Play tokens and utilities

**Files:**
- Modify: `app/src/styles/global.css`. Add `--shadow-magnifier` after `--shadow-card` (:94), and add utilities after `@utility start-bar-fade` (:449–451).
- Test: `app/tests/lib/ui/brand-tokens.test.ts` (append; reuse its `decl()` / `block()` helpers).

**Interfaces:**
- Produces these utilities: `glass-active-seat`, `input-well`, `key-press`, `next-dart-ring`, `target-key-ring`, `pip-on`, `board-dim` and `shadow-magnifier`. Later tasks use the class names only.

- [ ] **Step 1: Write the failing test.** Append to `brand-tokens.test.ts`:

```ts
describe("game play surfaces", () => {
  it.each([
    "@utility glass-active-seat",
    "@utility input-well",
    "@utility key-press",
    "@utility next-dart-ring",
    "@utility target-key-ring",
    "@utility pip-on",
    "@utility board-dim",
  ])("defines %s", (selector) => {
    expect(() => block(selector)).not.toThrow();
  });

  it("tints the active seat card accent 18% to 4% over the glass wash, with a glow", () => {
    const b = block("@utility glass-active-seat");
    expect(b).toMatch(/color-mix\(in oklch, var\(--accent\) 18%, transparent\)/);
    expect(b).toMatch(/color-mix\(in oklch, var\(--accent\) 4%, transparent\)/);
    expect(b).toMatch(/border-white\/25/);
    expect(b).toMatch(
      /box-shadow:\s*0 0 18px 2px color-mix\(in oklch, var\(--accent\) 30%, transparent\)/,
    );
  });

  it("input-well is a glass board-radius well that fills the column", () => {
    expect(block("@utility input-well")).toMatch(
      /@apply glass rounded-board flex-1 min-h-0 gap-2 p-2\.5;/,
    );
  });

  it("key-press rings the key in accent on :active, with no scale", () => {
    const b = block("@utility key-press");
    expect(b).toMatch(/transition: box-shadow 120ms var\(--ease-out\)/);
    expect(b).toMatch(/&:active:not\(:disabled\)/);
    expect(b).toMatch(
      /inset 0 0 0 1px color-mix\(in oklch, var\(--accent\) 60%, transparent\)/,
    );
    expect(b).not.toMatch(/scale/);
  });

  it("next-dart-ring is an accent/70 inset ring with an accent/30 glow on a well", () => {
    const b = block("@utility next-dart-ring");
    expect(b).toMatch(/background: oklch\(0% 0 0 \/ 0\.35\)/);
    expect(b).toMatch(
      /inset 0 0 0 1px color-mix\(in oklch, var\(--accent\) 70%, transparent\)/,
    );
    expect(b).toMatch(
      /0 0 10px color-mix\(in oklch, var\(--accent\) 30%, transparent\)/,
    );
  });

  it("target-key-ring keeps the accent ring but drops the glow", () => {
    const b = block("@utility target-key-ring");
    expect(b).toMatch(
      /inset 0 0 0 1px color-mix\(in oklch, var\(--accent\) 70%, transparent\)/,
    );
    expect(b).not.toMatch(/0 0 10px/);
  });

  it("pip-on is accent with an accent/40 glow", () => {
    const b = block("@utility pip-on");
    expect(b).toMatch(/background: var\(--accent\)/);
    expect(b).toMatch(
      /box-shadow:\s*0 0 6px color-mix\(in oklch, var\(--accent\) 40%, transparent\)/,
    );
  });

  it("board-dim desaturates and darkens the board", () => {
    expect(block("@utility board-dim")).toMatch(
      /filter: saturate\(0\.55\) brightness\(0\.75\)/,
    );
  });

  it("defines the magnifier drop shadow", () => {
    expect(decl("shadow-magnifier")).toBe("0 8px 24px oklch(0% 0 0 / 0.6)");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** `npm test -- tests/lib/ui/brand-tokens.test.ts`. Every new case fails, either with "… not found" or with `undefined`.

- [ ] **Step 3: Implement.** In `global.css`, inside `@theme inline`, add this line directly under `--shadow-card: …;`:

```css
  --shadow-magnifier: 0 8px 24px oklch(0% 0 0 / 0.6);
```

Then add the following after the `@utility start-bar-fade { … }` block, before `@layer components`:

```css
@utility glass-active-seat {
  @apply border-y border-white/25 backdrop-blur-sm;
  background:
    linear-gradient(
      180deg,
      color-mix(in oklch, var(--accent) 18%, transparent),
      color-mix(in oklch, var(--accent) 4%, transparent)
    ),
    radial-gradient(
      at 50% 0%,
      oklch(100% 0 0 / 0.05),
      oklch(100% 0 0 / 0.1) 85%
    );
  box-shadow: 0 0 18px 2px color-mix(in oklch, var(--accent) 30%, transparent);
}

@utility input-well {
  @apply glass rounded-board flex-1 min-h-0 gap-2 p-2.5;
}

@utility key-press {
  transition: box-shadow 120ms var(--ease-out);

  &:active:not(:disabled) {
    box-shadow:
      inset 0 0 0 1px color-mix(in oklch, var(--accent) 60%, transparent),
      inset 0 1px 2px oklch(0% 0 0 / 0.4);
  }
}

@utility next-dart-ring {
  background: oklch(0% 0 0 / 0.35);
  box-shadow:
    inset 0 0 0 1px color-mix(in oklch, var(--accent) 70%, transparent),
    0 0 10px color-mix(in oklch, var(--accent) 30%, transparent);
}

@utility target-key-ring {
  background: oklch(0% 0 0 / 0.35);
  box-shadow:
    inset 0 0 0 1px color-mix(in oklch, var(--accent) 70%, transparent),
    inset 0 1px 2px oklch(0% 0 0 / 0.4);
}

@utility pip-on {
  background: var(--accent);
  box-shadow: 0 0 6px color-mix(in oklch, var(--accent) 40%, transparent);
}

@utility board-dim {
  filter: saturate(0.55) brightness(0.75);
}
```

- [ ] **Step 4: Run, expect PASS.** `npm test -- tests/lib/ui/brand-tokens.test.ts`. Then run `npm run format` and re-run the test: Prettier may re-wrap lines, and the regexes tolerate that.

- [ ] **Step 5: Commit.**

```bash
git add src/styles/global.css tests/lib/ui/brand-tokens.test.ts
git commit -m "feat(tokens): game play surfaces and magnifier shadow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Play display helpers and Alpine magics

**Files:**
- Create: `app/src/lib/ui/play-display.ts`
- Modify: `app/src/lib/ui/types.ts` (append the types)
- Modify: `app/src/lib/client/alpine/register-ui-data.ts`
- Create test: `app/tests/lib/ui/play-display.test.ts`
- Modify test: `app/tests/lib/client/alpine/register-ui-data.test.ts`

**Interfaces:**
- Produces these functions:
  - `bigValueSize(value: unknown): string`, returning `"text-[84px]" | "text-[64px]" | "text-[46px]"`
  - `seatValueSize(value: unknown): string`, returning `"text-[64px]" | "text-[46px]"`
  - `legBarStates(won: number, toWin: number): LegBarState[] | null`
  - `previewColumnState(segments: readonly { status: PreviewStatus }[]): PreviewColumn[]`
  - `ringKeyActive(ring: TapRing, key: RingKey): boolean`
- Produces these types (in `lib/ui/types.ts`, raised by `@lib/types`): `LegBarState = "won" | "open"`, `PreviewStatus = "hit" | "miss" | "empty"`, `PreviewColumn = { status: PreviewStatus; next: boolean }`, `TapRing = "SINGLE" | "DOUBLE" | "TREBLE"`, `RingKey = "S" | "D" | "T"`.
- Produces these Alpine magics: `$bigValueSize`, `$seatValueSize`, `$legBarStates`, `$previewColumnState`, `$ringKeyActive`. Each returns its function.

- [ ] **Step 1: Write the failing test.** Create `app/tests/lib/ui/play-display.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  bigValueSize,
  legBarStates,
  previewColumnState,
  ringKeyActive,
  seatValueSize,
} from "@lib/ui/play-display";
import type { RingKey, TapRing } from "@lib/types";

describe("bigValueSize", () => {
  it.each([
    ["7", "text-[84px]"],
    ["20", "text-[84px]"],
    ["501", "text-[64px]"],
    ["BULL", "text-[46px]"],
    ["1,234", "text-[46px]"],
  ])("sizes %s as %s", (value, expected) => {
    expect(bigValueSize(value)).toBe(expected);
  });

  it("measures a number by its digits", () => {
    expect(bigValueSize(170)).toBe("text-[64px]");
  });

  it("treats a missing value as empty", () => {
    expect(bigValueSize(null)).toBe("text-[84px]");
  });
});

describe("seatValueSize", () => {
  it.each([
    ["7", "text-[64px]"],
    ["170", "text-[64px]"],
    ["BULL", "text-[46px]"],
    ["1,234", "text-[46px]"],
  ])("sizes %s as %s", (value, expected) => {
    expect(seatValueSize(value)).toBe(expected);
  });
});

describe("legBarStates", () => {
  it.each([
    [0, 3, ["open", "open", "open"]],
    [2, 3, ["won", "won", "open"]],
    [3, 3, ["won", "won", "won"]],
    [5, 5, ["won", "won", "won", "won", "won"]],
  ])("%i of %i", (won, toWin, expected) => {
    expect(legBarStates(won, toWin)).toEqual(expected);
  });

  it("switches to the counter above five legs", () => {
    expect(legBarStates(0, 6)).toBeNull();
  });

  it("draws no bars before the leg target is known", () => {
    expect(legBarStates(0, 0)).toEqual([]);
  });

  it("never paints more won bars than legs to win", () => {
    expect(legBarStates(4, 3)).toEqual(["won", "won", "won"]);
  });
});

describe("previewColumnState", () => {
  it("marks only the first empty dart as next", () => {
    expect(
      previewColumnState([
        { status: "empty" },
        { status: "empty" },
        { status: "empty" },
      ]),
    ).toEqual([
      { status: "empty", next: true },
      { status: "empty", next: false },
      { status: "empty", next: false },
    ]);
  });

  it("keeps hit and miss columns and moves next past them", () => {
    expect(
      previewColumnState([
        { status: "hit" },
        { status: "miss" },
        { status: "empty" },
      ]),
    ).toEqual([
      { status: "hit", next: false },
      { status: "miss", next: false },
      { status: "empty", next: true },
    ]);
  });

  it("has no next dart once the visit is full", () => {
    expect(
      previewColumnState([
        { status: "hit" },
        { status: "hit" },
        { status: "miss" },
      ]).some((column) => column.next),
    ).toBe(false);
  });
});

describe("ringKeyActive", () => {
  it.each<[TapRing, RingKey, boolean]>([
    ["SINGLE", "S", true],
    ["DOUBLE", "D", true],
    ["TREBLE", "T", true],
    ["SINGLE", "D", false],
    ["DOUBLE", "S", false],
    ["TREBLE", "D", false],
  ])("ring %s lights key %s: %s", (ring, key, expected) => {
    expect(ringKeyActive(ring, key)).toBe(expected);
  });
});
```

Append to `register-ui-data.test.ts`. Add this import at the top:

```ts
import {
  bigValueSize,
  legBarStates,
  previewColumnState,
  ringKeyActive,
  seatValueSize,
} from "@lib/ui/play-display";
```

Then add this case inside `describe("registerUiData", …)`:

```ts
  it("registers the play display helpers as Alpine magics", () => {
    const magic = vi.fn();
    registerUiData({ data: vi.fn(), magic } as unknown as Alpine);
    const getters = Object.fromEntries(
      magic.mock.calls.map(([name, getter]) => [name, getter()]),
    );
    expect(getters.bigValueSize).toBe(bigValueSize);
    expect(getters.seatValueSize).toBe(seatValueSize);
    expect(getters.legBarStates).toBe(legBarStates);
    expect(getters.previewColumnState).toBe(previewColumnState);
    expect(getters.ringKeyActive).toBe(ringKeyActive);
  });
```

- [ ] **Step 2: Run, expect FAIL.** `npm test -- tests/lib/ui/play-display.test.ts tests/lib/client/alpine/register-ui-data.test.ts`. Both fail with "Failed to resolve import @lib/ui/play-display".

- [ ] **Step 3: Implement.** Append to `app/src/lib/ui/types.ts`:

```ts
/** One `LegBars` pill: a leg already won, or one still to win. */
export type LegBarState = "won" | "open";

/** A dart slot's outcome in the visit strip. */
export type PreviewStatus = "hit" | "miss" | "empty";

/** One visit-strip column; `next` marks the dart about to be thrown. */
export type PreviewColumn = { status: PreviewStatus; next: boolean };

/** The ring armed on the Cricket / Tactics tap input. */
export type TapRing = "SINGLE" | "DOUBLE" | "TREBLE";

/** A ring key's label on that input. */
export type RingKey = "S" | "D" | "T";
```

Create `app/src/lib/ui/play-display.ts`:

```ts
import type {
  LegBarState,
  PreviewColumn,
  PreviewStatus,
  RingKey,
  TapRing,
} from "./types";

/** Above this many legs to win, `LegBars` shows a `won/target` counter. */
const MAX_LEG_BARS = 5;

const RING_KEY: Readonly<Record<TapRing, RingKey>> = {
  SINGLE: "S",
  DOUBLE: "D",
  TREBLE: "T",
};

function charCount(value: unknown): number {
  return String(value ?? "").length;
}

/**
 * Font-size class for the solo scoreboard's big value, stepped by length so
 * it fits the card's left column: up to 2 characters 84px, 3 → 64px,
 * 4 or more → 46px.
 */
export function bigValueSize(value: unknown): string {
  const length = charCount(value);
  if (length <= 2) return "text-[84px]";
  if (length === 3) return "text-[64px]";
  return "text-[46px]";
}

/** Font-size class for the active seat card's score: 64px up to 3 characters, 46px from 4. */
export function seatValueSize(value: unknown): string {
  return charCount(value) <= 3 ? "text-[64px]" : "text-[46px]";
}

/**
 * One bar per leg to win, the first `won` of them filled. `null` above
 * `MAX_LEG_BARS` legs, where `LegBars` shows a `won/target` counter instead.
 */
export function legBarStates(
  won: number,
  toWin: number,
): LegBarState[] | null {
  if (toWin > MAX_LEG_BARS) return null;
  return Array.from({ length: Math.max(toWin, 0) }, (_, index) =>
    index < won ? "won" : "open",
  );
}

/** The visit strip's columns; only the first empty dart is `next`. */
export function previewColumnState(
  segments: readonly { status: PreviewStatus }[],
): PreviewColumn[] {
  const nextIndex = segments.findIndex(
    (segment) => segment.status === "empty",
  );
  return segments.map((segment, index) => ({
    status: segment.status,
    next: index === nextIndex,
  }));
}

/** Whether a ring key lights for the armed ring: S for SINGLE, D for DOUBLE, T for TREBLE. */
export function ringKeyActive(ring: TapRing, key: RingKey): boolean {
  return RING_KEY[ring] === key;
}
```

In `register-ui-data.ts`, add this import:

```ts
import {
  bigValueSize,
  legBarStates,
  previewColumnState,
  ringKeyActive,
  seatValueSize,
} from "@lib/ui/play-display";
```

Then add these lines after `Alpine.magic("playerCount", …)`:

```ts
  Alpine.magic("bigValueSize", () => bigValueSize);
  Alpine.magic("seatValueSize", () => seatValueSize);
  Alpine.magic("legBarStates", () => legBarStates);
  Alpine.magic("previewColumnState", () => previewColumnState);
  Alpine.magic("ringKeyActive", () => ringKeyActive);
```

- [ ] **Step 4: Run, expect PASS.** Run the same two files. Then run `bash ../scripts/check-type-barrels.sh`, which should print OK.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/ui/play-display.ts src/lib/ui/types.ts src/lib/client/alpine/register-ui-data.ts tests/lib/ui/play-display.test.ts tests/lib/client/alpine/register-ui-data.test.ts
git commit -m "feat(play): display helpers as Alpine magics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Subtitle helpers and shared order labels

**Files:**
- Create: `app/src/lib/game/play-subtitle.ts`
- Create test: `app/tests/lib/game/play-subtitle.test.ts`
- Modify:
  - `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro:18-22`
  - `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro:18-22`
  - `app/src/components/layout/games/setup/AroundTheClockSetupForm.astro:24-27`

**Interfaces:**
- Produces:
  - `ORDER_MODE_LABELS: Readonly<Record<TargetOrderMode, string>>`
  - `joinSubtitle(parts: readonly string[]): string`
  - `orderModeLabel(mode: TargetOrderMode): string`, which returns the label uppercased (`"LOW → HIGH"`)

- [ ] **Step 1: Write the failing test.** Create `app/tests/lib/game/play-subtitle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ORDER_MODE_LABELS,
  joinSubtitle,
  orderModeLabel,
} from "@lib/game/play-subtitle";

describe("joinSubtitle", () => {
  it("joins parts with a middle dot", () => {
    expect(joinSubtitle(["LEG 2", "FIRST TO 3"])).toBe("LEG 2 · FIRST TO 3");
  });

  it("drops empty parts", () => {
    expect(joinSubtitle(["", "ROUND 4", ""])).toBe("ROUND 4");
  });

  it("is empty when every part is", () => {
    expect(joinSubtitle(["", ""])).toBe("");
  });
});

describe("orderModeLabel", () => {
  it.each([
    ["LOW_TO_HIGH", "LOW → HIGH"],
    ["HIGH_TO_LOW", "HIGH → LOW"],
    ["RANDOM", "RANDOM"],
  ] as const)("maps %s to %s", (mode, expected) => {
    expect(orderModeLabel(mode)).toBe(expected);
  });
});

describe("ORDER_MODE_LABELS", () => {
  it("keeps the setup wording, in setup order", () => {
    expect(Object.entries(ORDER_MODE_LABELS)).toEqual([
      ["LOW_TO_HIGH", "Low → High"],
      ["HIGH_TO_LOW", "High → Low"],
      ["RANDOM", "Random"],
    ]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** `npm test -- tests/lib/game/play-subtitle.test.ts` fails with a module-not-found error.

- [ ] **Step 3: Implement.** Create `app/src/lib/game/play-subtitle.ts`:

```ts
import type { TargetOrderMode } from "./types";

/** Setup labels for a target-order mode, in setup order; play subtitles uppercase them. */
export const ORDER_MODE_LABELS: Readonly<Record<TargetOrderMode, string>> = {
  LOW_TO_HIGH: "Low → High",
  HIGH_TO_LOW: "High → Low",
  RANDOM: "Random",
};

/** A play-header subtitle: the non-empty parts joined with " · ". */
export function joinSubtitle(parts: readonly string[]): string {
  return parts.filter((part) => part !== "").join(" · ");
}

/** A target-order mode's setup label in subtitle case (`LOW → HIGH`). */
export function orderModeLabel(mode: TargetOrderMode): string {
  return ORDER_MODE_LABELS[mode].toUpperCase();
}
```

- [ ] **Step 4: Run, expect PASS.** Same command.

- [ ] **Step 5: Setup forms import the labels.** These are adjacent edits that avoid a second copy of the labels.
  - In `SinglesTrainingSetupForm.astro` and `DoublesTrainingSetupForm.astro`:
    - Add `import { ORDER_MODE_LABELS } from "@lib/game/play-subtitle";` under the existing `supportsDartbot` import.
    - Replace the `const orderModeOpts = [ … ];` literal with:

    ```ts
    const orderModeOpts = Object.entries(ORDER_MODE_LABELS).map(
      ([value, label]) => ({ value, label }),
    );
    ```

  - In `AroundTheClockSetupForm.astro`:
    - Add the same import.
    - Replace `directionOpts` with:

    ```ts
    const directionOpts = [
      { value: "LOW_TO_HIGH", label: ORDER_MODE_LABELS.LOW_TO_HIGH },
      { value: "HIGH_TO_LOW", label: ORDER_MODE_LABELS.HIGH_TO_LOW },
    ];
    ```

  - Check: `grep -rn '"Low → High"' src` lists only `src/lib/game/play-subtitle.ts`.

- [ ] **Step 6: Gates.** Run `npx astro check --minimumFailingSeverity hint`, which must report 0/0/0. Then run `npm test -- tests/lib/game`, which must pass.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/game/play-subtitle.ts tests/lib/game/play-subtitle.test.ts src/components/layout/games/setup/SinglesTrainingSetupForm.astro src/components/layout/games/setup/DoublesTrainingSetupForm.astro src/components/layout/games/setup/AroundTheClockSetupForm.astro
git commit -m "feat(play): subtitle helpers; order labels shared with setup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: x01-family getters (501, 121, Ten Up One Down)

**Files:**
- Modify:
  - `app/src/lib/game/five-oh-one-play.data.ts`: insert after `matchTitle` (:336-339)
  - `app/src/lib/game/one-twenty-one-play.data.ts`:
    - `DARTS_PER_VISIT` (:68)
    - delete `dartsLeftInOpenVisit` (:164-173)
    - `checkoutHint` (:417-426)
    - the `play-visit-stats` import (:31-34)
  - `app/src/lib/game/tuod-play.data.ts`: insert after `remainingInAttempt` (:283-288)
  - `app/src/lib/game/types.ts` (context method lists)
- Test:
  - `app/tests/lib/game/five-oh-one-play.data.test.ts`
  - `app/tests/lib/game/one-twenty-one-play.data.test.ts`
  - `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Consumes: `joinSubtitle` (Task 3), and `dartsLeftForSeat(turns, seatRef, max)` from `@lib/game/play-visit-stats`, which already exists.
- Produces:
  - 501: `subtitle(): string`, `legsToWin(): number`
  - 121:
    - `subtitle(): string`
    - `checkoutHintFor(seatRef: string): string`
    - `dartsThisAttemptFor(seatRef: string): number`
    - `dartsThisAttempt(): number`
  - TUOD:
    - `subtitle(): string`
    - `attemptsFor(seatRef: string): number`
    - `attempts(): number`
    - `successFailureFor(seatRef: string): string` (`"3 · 1"`)
    - `successFailure(): string`

- [ ] **Step 1: Write the failing tests.**

Append to `five-oh-one-play.data.test.ts`:

```ts
describe("subtitle", () => {
  it("is blank before a session's config has loaded", () => {
    const play = makePlay({ configSnapshot: null });
    expect(play.subtitle()).toBe("");
  });

  it("names the open leg and the match target", () => {
    const play = makePlay();
    expect(play.subtitle()).toBe("LEG 1 · FIRST TO 1");
  });

  it("counts legs as stages open", () => {
    const play = makePlay({
      configSnapshot: bestOf5Config(),
      stages: [LEG_1, { ...LEG_1, clientKey: "leg-2", sequence: 2 }],
    });
    expect(play.subtitle()).toBe("LEG 2 · FIRST TO 3");
  });

  it("reads leg 1 before the first stage is written", () => {
    const play = makePlay({ stages: [] });
    expect(play.subtitle()).toBe("LEG 1 · FIRST TO 1");
  });
});

describe("legsToWin", () => {
  it("is 0 before config loads", () => {
    expect(makePlay({ configSnapshot: null }).legsToWin()).toBe(0);
  });

  it("reads the configured leg target", () => {
    expect(makePlay({ configSnapshot: bestOf5Config() }).legsToWin()).toBe(3);
  });
});
```

In `one-twenty-one-play.data.test.ts`, add this import under the existing `import type { OneTwentyOnePlayContext } …` line:

```ts
import type { DartFact, TurnFact } from "@modules/types";
```

Then append:

```ts
describe("oneTwentyOnePlay — play header and seat stats", () => {
  let store: OneTwentyOnePlayContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = baseStore();
  });

  function createPlay(): OneTwentyOnePlayContext {
    return { ...oneTwentyOnePlay(), $store: store } as OneTwentyOnePlayContext;
  }

  function missDart(sequence: number): DartFact {
    return {
      sequence,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      score: 0,
      locationX: null,
      locationY: null,
    };
  }

  function visit(
    sequence: number,
    totalScore: number,
    participantRef = "participant-1",
  ): TurnFact {
    return {
      clientKey: `t${sequence}`,
      stageClientKey: "round-1",
      participantRef,
      sequence,
      completedAt: "2026-10-08T10:00:00.000Z",
      totalScore,
      darts: [],
    };
  }

  it("subtitle is blank before config loads", () => {
    store.game.configSnapshot = null;
    expect(createPlay().subtitle()).toBe("");
  });

  it("subtitle opens on attempt 1 of nine darts", () => {
    expect(createPlay().subtitle()).toBe("ATTEMPT 1 · 9 DARTS");
  });

  it("subtitle moves on once three visits resolve the attempt", () => {
    store.game.turns = [visit(1, 20), visit(2, 20), visit(3, 20)];
    expect(createPlay().subtitle()).toBe("ATTEMPT 2 · 9 DARTS");
  });

  it("dartsThisAttempt counts three per closed visit plus the open visit's darts", () => {
    store.game.turns = [
      visit(1, 20),
      visit(2, 20),
      { ...visit(3, 0), completedAt: null, darts: [missDart(1)] },
    ];
    expect(createPlay().dartsThisAttempt()).toBe(7);
  });

  it("dartsThisAttemptFor reads 0 for a seat yet to throw", () => {
    store.game.configSnapshot = { seats: TWO_SEATS };
    store.game.turns = [visit(1, 20)];
    expect(createPlay().dartsThisAttemptFor("participant-2")).toBe(0);
  });

  it("checkoutHintFor gives a waiting seat its full three-dart route", () => {
    store.game.configSnapshot = { seats: TWO_SEATS };
    store.game.turns = [
      { ...visit(1, 0), completedAt: null, darts: [missDart(1), missDart(2)] },
    ];
    const play = createPlay();
    expect(play.checkoutHintFor("participant-1")).toBe("");
    expect(play.checkoutHintFor("participant-2")).toBe("T20 T11 D14");
  });
});
```

Append to `tuod-play.data.test.ts`. It must come after `const TWO_SEATS`, which is declared near :1317:

```ts
describe("tuodPlay — play header and seat stats", () => {
  function makePlay(overrides: Partial<GameStub> = {}) {
    return {
      ...tuodPlay(),
      $store: { game: gameStub(overrides), settings: settingsStub() },
    } as TuodPlayContext;
  }

  it("subtitle is blank before config loads", () => {
    expect(makePlay({ configSnapshot: null }).subtitle()).toBe("");
  });

  it("subtitle names the next attempt", () => {
    expect(makePlay().subtitle()).toBe("ATTEMPT 1");
    expect(
      makePlay({ turns: [turnFact("t1", 1, 41), turnFact("t2", 2, 0)] }).subtitle(),
    ).toBe("ATTEMPT 3");
  });

  it("counts attempts, successes and failures", () => {
    const play = makePlay({
      turns: [turnFact("t1", 1, 41), turnFact("t2", 2, 0)],
    });
    expect(play.attempts()).toBe(2);
    expect(play.attemptsFor("participant-1")).toBe(2);
    expect(play.successFailure()).toBe("1 · 1");
    expect(play.successFailureFor("participant-1")).toBe("1 · 1");
  });

  it("reads zeros for a seat with no attempts yet", () => {
    const play = makePlay({ configSnapshot: { ...rounds(3), seats: TWO_SEATS } });
    expect(play.attemptsFor("participant-2")).toBe(0);
    expect(play.successFailureFor("participant-2")).toBe("0 · 0");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** `npm test -- tests/lib/game/five-oh-one-play.data.test.ts tests/lib/game/one-twenty-one-play.data.test.ts tests/lib/game/tuod-play.data.test.ts`. The new cases fail with "is not a function", or TS reports unknown members.

- [ ] **Step 3: Implement 501.** In `five-oh-one-play.data.ts`:
  - Add the import `import { joinSubtitle } from "@lib/game/play-subtitle";` beside the other `@lib/game/*` imports.
  - Insert after `matchTitle(…) { … },`:

```ts
    /** Play-header subtitle: the open leg and the match target (`LEG 2 · FIRST TO 3`); blank before config loads. */
    subtitle(this: FiveOhOnePlayContext): string {
      const legsToWin = this.$store.game.configSnapshot?.legsToWin;
      if (!legsToWin) return "";
      return joinSubtitle([
        `LEG ${Math.max(this.$store.game.stages.length, 1)}`,
        `FIRST TO ${legsToWin}`,
      ]);
    },

    /** Legs a side needs to win the match; 0 before config loads. */
    legsToWin(this: FiveOhOnePlayContext): number {
      return this.$store.game.configSnapshot?.legsToWin ?? 0;
    },
```

- [ ] **Step 4: Implement 121.** In `one-twenty-one-play.data.ts`:
  - Extend the `play-visit-stats` import to `{ checkoutPercentageDisplay, dartsLeftForSeat, dartsThrownCount }`.
  - Add `import { joinSubtitle } from "@lib/game/play-subtitle";`.
  - Under `const DARTS_PER_VISIT = 3;`, add:

    ```ts
    /** Three visits make one 121 attempt, so an attempt is nine darts. */
    const DARTS_PER_ATTEMPT = 3 * DARTS_PER_VISIT;
    ```

  - Delete the private `dartsLeftInOpenVisit` function and its JSDoc (:164-173). Its only caller is replaced below.
  - If `TurnFact` is then unused in the file, drop it from the type import.
  - Replace the `checkoutHint` method (with its JSDoc) with:

```ts
    /**
     * The finish route for what is left in the seat's open attempt, blank
     * when no route fits the darts its visit has left (#291). A seat that
     * is not throwing reads its full visit.
     */
    checkoutHintFor(this: OneTwentyOnePlayContext, seatRef: string): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const remaining = this.remainingInAttemptFor(seatRef);
      const dartsLeft = dartsLeftForSeat(
        this.$store.game.turns,
        seatRef,
        DARTS_PER_VISIT,
      );
      return checkoutPathWithin(remaining, dartsLeft)?.join(" ") ?? "";
    },

    checkoutHint(this: OneTwentyOnePlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.checkoutHintFor(state.activeParticipantRef);
    },

    /** Darts the seat has thrown in its open attempt: three per closed visit plus the open visit's own. */
    dartsThisAttemptFor(this: OneTwentyOnePlayContext, seatRef: string): number {
      const openDarts =
        DARTS_PER_VISIT -
        dartsLeftForSeat(this.$store.game.turns, seatRef, DARTS_PER_VISIT);
      return this.visitsThisAttemptFor(seatRef) * DARTS_PER_VISIT + openDarts;
    },

    dartsThisAttempt(this: OneTwentyOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.dartsThisAttemptFor(state.activeParticipantRef);
    },

    /** Play-header subtitle: the throwing seat's attempt (`ATTEMPT 3 · 9 DARTS`); blank before config loads. */
    subtitle(this: OneTwentyOnePlayContext): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!seat) return "";
      return joinSubtitle([
        `ATTEMPT ${seat.attemptsCompleted + 1}`,
        `${DARTS_PER_ATTEMPT} DARTS`,
      ]);
    },
```

- [ ] **Step 5: Implement TUOD.** In `tuod-play.data.ts`, insert after `remainingInAttempt(…) { … },`:

```ts
    /** Play-header subtitle: the throwing seat's next attempt (`ATTEMPT 4`); blank before config loads. */
    subtitle(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return `ATTEMPT ${this.attemptsFor(state.activeParticipantRef) + 1}`;
    },

    attemptsFor(this: TuodPlayContext, seatRef: string): number {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.attempts ?? 0;
    },

    attempts(this: TuodPlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.attemptsFor(state.activeParticipantRef);
    },

    /** The seat's resolved attempts as `successes · failures` (`3 · 1`). */
    successFailureFor(this: TuodPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return `${seat?.successes ?? 0} · ${seat?.failures ?? 0}`;
    },

    successFailure(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "0 · 0";
      return this.successFailureFor(state.activeParticipantRef);
    },
```

- [ ] **Step 6: Context types.** In `app/src/lib/game/types.ts`:
  - `FiveOhOnePlayContext`, after `matchTitle(this: FiveOhOnePlayContext): string;`:

    ```ts
      subtitle(this: FiveOhOnePlayContext): string;
      legsToWin(this: FiveOhOnePlayContext): number;
    ```

  - `OneTwentyOnePlayContext`, replacing `checkoutHint(this: OneTwentyOnePlayContext): string;` with:

    ```ts
      checkoutHintFor(this: OneTwentyOnePlayContext, seatRef: string): string;
      checkoutHint(this: OneTwentyOnePlayContext): string;
      dartsThisAttemptFor(this: OneTwentyOnePlayContext, seatRef: string): number;
      dartsThisAttempt(this: OneTwentyOnePlayContext): number;
      subtitle(this: OneTwentyOnePlayContext): string;
    ```

  - `TuodPlayContext`, after `remainingInAttempt(this: TuodPlayContext): number;`:

    ```ts
      subtitle(this: TuodPlayContext): string;
      attemptsFor(this: TuodPlayContext, seatRef: string): number;
      attempts(this: TuodPlayContext): number;
      successFailureFor(this: TuodPlayContext, seatRef: string): string;
      successFailure(this: TuodPlayContext): string;
    ```

- [ ] **Step 7: Run, expect PASS.**
  - Run the three files from Step 2. The existing `checkoutHint` cases must stay green.
  - Then run `npx astro check --minimumFailingSeverity hint`, which must report 0/0/0.

- [ ] **Step 8: Commit.**

```bash
git add src/lib/game/five-oh-one-play.data.ts src/lib/game/one-twenty-one-play.data.ts src/lib/game/tuod-play.data.ts src/lib/game/types.ts tests/lib/game/five-oh-one-play.data.test.ts tests/lib/game/one-twenty-one-play.data.test.ts tests/lib/game/tuod-play.data.test.ts
git commit -m "feat(play): x01-family subtitles and seat getters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Around the Clock and Score training getters

**Files:**
- Modify:
  - `app/src/lib/game/around-the-clock-play.data.ts`: insert after `hitsNeededLabel` (:380-389)
  - `app/src/lib/game/score-training-play.data.ts`: insert after `totalScoreFor` (:198-203)
  - `app/src/lib/game/types.ts`
- Test:
  - `app/tests/lib/game/around-the-clock-play.data.test.ts`
  - `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `joinSubtitle` (Task 3), plus `rulesOf` and `laps()`, which already exist in Around the Clock.
- Produces:
  - Around the Clock: `subtitle(): string`, `hitsToGoFor(seatRef: string): string` (`"2 to hit"`, or `""` on Easy), `hitsToGo(): string`
  - Score training: `subtitle(): string`

- [ ] **Step 1: Write the failing tests.**

In `around-the-clock-play.data.test.ts`, add this top-level block after `describe("currentTargetLabel / turnsSoFar / isBullVisit", …)`:

```ts
describe("subtitle", () => {
  it("is blank before config loads", () => {
    const play = makePlay({ configSnapshot: null });
    expect(play.subtitle.call(play)).toBe("");
  });

  it("names lap 1 and the path's ends", () => {
    const play = makePlay();
    expect(play.subtitle.call(play)).toBe("LAP 1 · 1 → 20");
  });

  it("keeps the number before BULL as the path's end once BULL is the target", () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    expect(play.subtitle.call(play)).toBe("LAP 1 · 1 → 20");
  });
});
```

Inside `describe("V2", …)`, directly after the `it("shows hits needed under a 1/2/3-dart difficulty", …)` case, add:

```ts
  it("counts the hits still to go under a 1/2/3-dart difficulty, blank on Easy", async () => {
    const play = makeV2({ difficulty: "HARD" });
    await play.init.call(play);
    expect(play.hitsToGo.call(play)).toBe("2 to hit");
    await play.recordDart.call(play, board(1, "OUTER_SINGLE"));
    expect(play.hitsToGo.call(play)).toBe("1 to hit");
    expect(play.hitsToGoFor.call(play, "participant-1")).toBe("1 to hit");

    const easy = makeV2();
    await easy.init.call(easy);
    expect(easy.hitsToGo.call(easy)).toBe("");
  });

  it("subtitles a high-to-low path from 20 down to 1", () => {
    const play = makeV2({ pathDirection: "HIGH_TO_LOW" });
    expect(play.subtitle.call(play)).toBe("LAP 1 · 20 → 1");
  });
```

Append to `score-training-play.data.test.ts`:

```ts
describe("scoreTrainingPlay — subtitle", () => {
  function makePlay(overrides: Partial<GameStub> = {}) {
    return {
      ...scoreTrainingPlay(),
      $store: { game: gameStub(overrides), settings: settingsStub() },
    } as ScoreTrainingPlayContext;
  }

  it("is blank before config loads", () => {
    expect(makePlay({ configSnapshot: null }).subtitle()).toBe("");
  });

  it("counts rounds against the ROUNDS budget", () => {
    expect(makePlay().subtitle()).toBe("ROUND 1 OF 2");
    expect(makePlay({ turns: [turnFact("t1", 1, 60)] }).subtitle()).toBe(
      "ROUND 2 OF 2",
    );
  });

  it("holds at the last round once the budget is spent", () => {
    expect(
      makePlay({
        turns: [turnFact("t1", 1, 60), turnFact("t2", 2, 45)],
      }).subtitle(),
    ).toBe("ROUND 2 OF 2");
  });

  it("drops the budget under MINUTES", () => {
    expect(
      makePlay({
        configSnapshot: minutes(10),
        turns: [turnFact("t1", 1, 60)],
      }).subtitle(),
    ).toBe("ROUND 2");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** `npm test -- tests/lib/game/around-the-clock-play.data.test.ts tests/lib/game/score-training-play.data.test.ts`. The new cases fail with "is not a function".

- [ ] **Step 3: Implement Around the Clock.**
  - Add `import { joinSubtitle } from "@lib/game/play-subtitle";`.
  - Insert after `hitsNeededLabel(…) { … },`:

```ts
    /**
     * Play-header subtitle: lap and path ends (`LAP 2 · 1 → 20`). The path
     * ends in BULL; its last number is the one before it. Blank before
     * config loads.
     */
    subtitle(this: AroundTheClockPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "";
      const numbers = rulesOf(config).path.flatMap((target) =>
        target.kind === "BULL" ? [] : [target.number],
      );
      return joinSubtitle([
        `LAP ${this.laps() + 1}`,
        `${numbers[0]} → ${numbers.at(-1)}`,
      ]);
    },

    /** Hits the seat still needs in its open visit (`2 to hit`); blank on Easy, where any hit advances. */
    hitsToGoFor(this: AroundTheClockPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot;
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      if (!config || !seat) return "";
      const { hitsRequired } = rulesOf(config);
      if (hitsRequired === 0) return "";
      return `${Math.max(hitsRequired - seat.hitsThisVisit, 0)} to hit`;
    },

    hitsToGo(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.hitsToGoFor(state.activeParticipantRef);
    },
```

- [ ] **Step 4: Implement Score training.** Insert after `totalScoreFor(…) { … },`:

```ts
    /** Play-header subtitle: `ROUND 3 OF 10`, or `ROUND 3` under MINUTES; blank before config loads. */
    subtitle(this: ScoreTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!config || !seat) return "";
      const round = seat.turnCount + 1;
      if (config.durationType === "MINUTES") return `ROUND ${round}`;
      return `ROUND ${Math.min(round, config.durationValue)} OF ${config.durationValue}`;
    },
```

- [ ] **Step 5: Context types.** In `types.ts`:
  - `AroundTheClockPlayContext`, after `hitsNeededLabel(this: AroundTheClockPlayContext): string;`:

    ```ts
      subtitle(this: AroundTheClockPlayContext): string;
      hitsToGoFor(this: AroundTheClockPlayContext, seatRef: string): string;
      hitsToGo(this: AroundTheClockPlayContext): string;
    ```

  - `ScoreTrainingPlayContext`, after `totalScoreFor(…): number;`:

    ```ts
      subtitle(this: ScoreTrainingPlayContext): string;
    ```

- [ ] **Step 6: Run, expect PASS.** Run the same two files, then `npx astro check --minimumFailingSeverity hint`, which must report 0/0/0.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/game/around-the-clock-play.data.ts src/lib/game/score-training-play.data.ts src/lib/game/types.ts tests/lib/game/around-the-clock-play.data.test.ts tests/lib/game/score-training-play.data.test.ts
git commit -m "feat(play): Around the Clock and Score training subtitles, hits to go

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Path and objective subtitles (Bob's 27, Doubles, Shanghai, Singles, Cricket, Tactics)

**Files:**
- Modify. Each insert goes after the factory's `state()` method:
  - `app/src/lib/game/bobs27-play.data.ts` (:201-208)
  - `app/src/lib/game/doubles-training-play.data.ts` (:181-188)
  - `app/src/lib/game/shanghai-play.data.ts` (:251-258; also add a module constant near `GAME_TYPE_KEY` at :56)
  - `app/src/lib/game/singles-training-play.data.ts` (:404-411)
  - `app/src/lib/game/cricket-play.data.ts` (:151-158)
  - `app/src/lib/game/tactics-play.data.ts` (:164-171)
  - `app/src/lib/game/types.ts`
- Test: the six matching `app/tests/lib/game/*-play.data.test.ts` files

**Interfaces:**
- Consumes: `joinSubtitle` and `orderModeLabel` (Task 3), plus `doublesPath()`, `CRICKET_OBJECTIVES` and `TACTICS_OBJECTIVES`, which each file already imports.
- Produces: `subtitle(): string` on all six factories.

- [ ] **Step 1: Write the failing tests.** Append one block to each file. Each one uses that file's own `makePlay`, `makeContext` or `defaultConfig` helpers.

`bobs27-play.data.test.ts`:

```ts
describe("subtitle", () => {
  it("is blank before config loads", () => {
    const play = makePlay({ configSnapshot: null });
    expect(play.subtitle.call(play)).toBe("");
  });

  it("counts rounds along the 21-target doubles path", () => {
    const play = makePlay();
    expect(play.subtitle.call(play)).toBe("ROUND 1 OF 21");
  });

  it("reads the last round at BULL", () => {
    const play = makePlay({ turns: priorTurnsThroughBull() });
    expect(play.subtitle.call(play)).toBe("ROUND 21 OF 21");
  });
});
```

`doubles-training-play.data.test.ts`:

```ts
describe("subtitle", () => {
  it("is blank before config loads", () => {
    const play = makePlay({ configSnapshot: null });
    expect(play.subtitle.call(play)).toBe("");
  });

  it.each([
    ["LOW_TO_HIGH", "LOW → HIGH"],
    ["HIGH_TO_LOW", "HIGH → LOW"],
    ["RANDOM", "RANDOM"],
  ] as const)("names the %s order with the setup wording", (orderMode, expected) => {
    const play = makePlay({ configSnapshot: { ...defaultConfig(), orderMode } });
    expect(play.subtitle.call(play)).toBe(expected);
  });
});
```

`shanghai-play.data.test.ts`:

```ts
describe("subtitle", () => {
  it("is blank before config loads", () => {
    const play = makePlay({ configSnapshot: null });
    expect(play.subtitle.call(play)).toBe("");
  });

  it("counts rounds of 20", () => {
    const play = makePlay();
    expect(play.subtitle.call(play)).toBe("ROUND 1 OF 20");
  });

  it("reads the last round", () => {
    const play = makePlay({ turns: priorRoundsThroughNumber(19) });
    expect(play.subtitle.call(play)).toBe("ROUND 20 OF 20");
  });
});
```

`singles-training-play.data.test.ts`:

```ts
describe("subtitle", () => {
  it("is blank before config loads", () => {
    const play = makePlay({ configSnapshot: null });
    expect(play.subtitle.call(play)).toBe("");
  });

  it.each([
    ["LOW_TO_HIGH", "LOW → HIGH"],
    ["HIGH_TO_LOW", "HIGH → LOW"],
    ["RANDOM", "RANDOM ORDER"],
  ] as const)("names the %s order with the setup wording", (orderMode, expected) => {
    const play = makePlay({ configSnapshot: { ...defaultConfig(), orderMode } });
    expect(play.subtitle.call(play)).toBe(expected);
  });
});
```

`cricket-play.data.test.ts`:

```ts
describe("subtitle", () => {
  it("is blank before config loads", () => {
    const ctx = makeContext({ configSnapshot: null });
    expect(ctx.subtitle.call(ctx)).toBe("");
  });

  it("names solo play and the seven objectives", () => {
    const ctx = makeContext();
    expect(ctx.subtitle.call(ctx)).toBe("SOLO · 7 OBJECTIVES");
  });
});
```

`tactics-play.data.test.ts`:

```ts
describe("subtitle", () => {
  it("is blank before config loads", () => {
    const ctx = makeContext({ configSnapshot: null });
    expect(ctx.subtitle.call(ctx)).toBe("");
  });

  it("names solo play and the nine objectives, Doubles and Triples included", () => {
    const ctx = makeContext();
    expect(ctx.subtitle.call(ctx)).toBe("SOLO · 9 OBJECTIVES");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** `npm test -- tests/lib/game/bobs27-play.data.test.ts tests/lib/game/doubles-training-play.data.test.ts tests/lib/game/shanghai-play.data.test.ts tests/lib/game/singles-training-play.data.test.ts tests/lib/game/cricket-play.data.test.ts tests/lib/game/tactics-play.data.test.ts`. The new cases fail with "subtitle is not a function".

- [ ] **Step 3: Implement.** Insert each method after the factory's `state()` method.

`bobs27-play.data.ts`:

```ts
    /** Play-header subtitle: `ROUND 4 OF 21` along the doubles path; blank before config loads. */
    subtitle(this: Bobs27PlayContext): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!seat) return "";
      const rounds = doublesPath().length;
      return `ROUND ${Math.min(seat.targetIndex + 1, rounds)} OF ${rounds}`;
    },
```

`doubles-training-play.data.ts`:
- Add `import { orderModeLabel } from "@lib/game/play-subtitle";`.
- Insert:

```ts
    /** Play-header subtitle: the session's target order in setup wording (`LOW → HIGH`); blank before config loads. */
    subtitle(this: DoublesTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      return config ? orderModeLabel(config.orderMode) : "";
    },
```

`shanghai-play.data.ts`:
- Under `const GAME_TYPE_KEY = "SHANGHAI";`, add:

  ```ts
  /** Shanghai is played over numbers 1–20, one round each. */
  const SHANGHAI_ROUNDS = 20;
  ```

- Insert:

```ts
    /** Play-header subtitle: `ROUND 7 OF 20`; blank before config loads. */
    subtitle(this: ShanghaiPlayContext): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!seat) return "";
      return `ROUND ${Math.min(seat.targetIndex + 1, SHANGHAI_ROUNDS)} OF ${SHANGHAI_ROUNDS}`;
    },
```

`singles-training-play.data.ts`:
- Add `import { orderModeLabel } from "@lib/game/play-subtitle";`.
- Insert:

```ts
    /** Play-header subtitle: the target order in setup wording, `RANDOM ORDER` for Random; blank before config loads. */
    subtitle(this: SinglesTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "";
      const label = orderModeLabel(config.orderMode);
      return config.orderMode === "RANDOM" ? `${label} ORDER` : label;
    },
```

`cricket-play.data.ts`:
- Add `import { joinSubtitle } from "@lib/game/play-subtitle";`.
- Insert:

```ts
    /** Play-header subtitle: `SOLO · 7 OBJECTIVES`; blank before config loads. */
    subtitle(this: CricketPlayContext): string {
      if (!this.$store.game.configSnapshot) return "";
      return joinSubtitle(["SOLO", `${CRICKET_OBJECTIVES.length} OBJECTIVES`]);
    },
```

`tactics-play.data.ts`:
- Add `import { joinSubtitle } from "@lib/game/play-subtitle";`.
- Insert:

```ts
    /** Play-header subtitle: `SOLO · 9 OBJECTIVES`; blank before config loads. */
    subtitle(this: TacticsPlayContext): string {
      if (!this.$store.game.configSnapshot) return "";
      return joinSubtitle(["SOLO", `${TACTICS_OBJECTIVES.length} OBJECTIVES`]);
    },
```

- [ ] **Step 4: Context types.** In `types.ts`, add `subtitle(this: <Ctx>): string;` directly under each context's `state(this: <Ctx>): …;` line. The six contexts are `Bobs27PlayContext`, `DoublesTrainingPlayContext`, `ShanghaiPlayContext`, `SinglesTrainingPlayContext`, `CricketPlayContext` and `TacticsPlayContext`.

- [ ] **Step 5: Run, expect PASS.** Run the six files from Step 2, then `npx astro check --minimumFailingSeverity hint`, which must report 0/0/0.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/game/bobs27-play.data.ts src/lib/game/doubles-training-play.data.ts src/lib/game/shanghai-play.data.ts src/lib/game/singles-training-play.data.ts src/lib/game/cricket-play.data.ts src/lib/game/tactics-play.data.ts src/lib/game/types.ts tests/lib/game/bobs27-play.data.test.ts tests/lib/game/doubles-training-play.data.test.ts tests/lib/game/shanghai-play.data.test.ts tests/lib/game/singles-training-play.data.test.ts tests/lib/game/cricket-play.data.test.ts tests/lib/game/tactics-play.data.test.ts
git commit -m "feat(play): path and objective subtitles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Play header (GameLayout, play pages, countdown controls)

**Files:**
- Modify:
  - `app/src/layouts/GameLayout.astro` (whole file)
  - `app/src/components/layout/games/CountdownPauseControl.astro` (whole file)
  - `app/src/components/layout/games/CountdownResumePrompt.astro` (whole file)
  - all 11 `app/src/pages/games/<slug>/play/index.astro` (the `<GameLayout>` opening tag and the first `<div>`)
  - `app/src/pages/training/routines/play/index.astro` and `app/src/pages/training/quick-subtract/index.astro`: drop `p-3` only
  - the four interfaces that render `CountdownPauseControl`: `interfaces/OneTwentyOne.astro:14,68-70`, `TenUpOneDown.astro:14,60-62`, `ScoreTraining.astro:14,101` and `AroundTheClock.astro:15,55`. Delete the import and the element.
  - `docs/architecture/07-Frontend/09-Adding-A-Game.md:86`
  - `app/src/lib/game/five-oh-one-play.data.ts`: delete `matchTitle` (:329-339)
  - `app/src/lib/game/types.ts`: delete `matchTitle(this: FiveOhOnePlayContext): string;` (:731)
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts`: delete `describe("matchTitle", …)` (:255-272)

**Interfaces:**
- Consumes: every factory's `subtitle()` (Tasks 4–6).
- Removes: 501's `matchTitle()`. Its last caller, `gameTitleExpr="matchTitle()"`, goes in Step 5.
- Produces:
  - `GameLayout` props: `{ title?, gameTitle?, gameTitleExpr?, gameSubtitleExpr?, exitDescription?, [key: string]: unknown }`. Leftover attributes go onto the wrapper around the header and `<main>`.
  - A named slot `header-end`.
  - `<main>` owns the play padding (`px-4 pt-1.5 pb-7.5`) and `gap-2`.
  - `CountdownPauseControl` keeps its props (`disabledExpr`) and now renders one pill `Button`.

No unit test: markup only (D101). Types and gates verify this task, and Task 11's visual pass checks it.

- [ ] **Step 1: Rewrite `GameLayout.astro`.**

```astro
---
/**
 * Play-screen shell: a 56px glass header pill — exit, title with an
 * optional live subtitle, and the `header-end` slot — over the play column,
 * plus the exit sheet and the wake-lock debug log. Leftover attributes
 * (the page's play `x-data` and its `@confirm-exit.window`) land on the
 * wrapper around header and main, so header expressions resolve in the
 * play scope (D432).
 * @param {string} [title] Document title
 * @param {string} [gameTitle] Static header title
 * @param {string} [gameTitleExpr] Alpine `x-text` title; wins over `gameTitle`
 * @param {string} [gameSubtitleExpr] Alpine `x-text` mono line under the title
 * @param {string} [exitDescription] Overrides ExitModal's default "recorded as abandoned" copy
 * @slot header-end Right of the title (the countdown pill); the 44px box keeps the title centred when empty
 */
interface Props {
  title?: string;
  gameTitle?: string;
  gameTitleExpr?: string;
  gameSubtitleExpr?: string;
  exitDescription?: string;
  [key: string]: unknown;
}

// Props
const {
  title,
  gameTitle,
  gameTitleExpr,
  gameSubtitleExpr,
  exitDescription,
  ...props
}: Props = Astro.props;

// Layouts
import BaseLayout from "@layouts/BaseLayout.astro";

// Components
import ExitModal from "@components/layout/games/ExitModal.astro";
import Button from "@components/forms/Button.astro";

// Icons
import ExitIcon from "@icons/exit.svg";

// Styles
const titleClass =
  "truncate font-display text-sm leading-tight tracking-[0.06em] text-foreground";
---

<BaseLayout title={title}>
  <div
    class="mx-auto flex h-full max-w-lg flex-col"
    x-data="gameLayout()"
  >
    <div
      class="flex min-h-0 flex-1 flex-col"
      {...props}
    >
      <div class="shrink-0 px-4 pt-2">
        <header class="glass flex h-14 items-center gap-2 rounded-full p-1.5">
          <Button
            type="button"
            variant="sheet-muted"
            icon
            ariaLabel="Exit game"
            loadingExpr="false"
            class="size-11 shrink-0 rounded-full p-0"
            @click="showExitModal = true"
          >
            <ExitIcon
              slot="iconBefore"
              class="size-[18px] text-muted-foreground"
            />
          </Button>
          <div class="flex min-w-0 flex-1 flex-col items-center text-center">
            {
              gameTitleExpr ? (
                <h1
                  class={titleClass}
                  x-text={gameTitleExpr}
                />
              ) : gameTitle ? (
                <h1 class={titleClass}>{gameTitle}</h1>
              ) : null
            }
            {
              gameSubtitleExpr && (
                <p
                  class="truncate font-mono text-eyebrow leading-tight text-muted-foreground"
                  x-text={gameSubtitleExpr}
                />
              )
            }
          </div>
          <div class="flex min-w-11 shrink-0 justify-end">
            <slot name="header-end" />
          </div>
        </header>
      </div>
      <main
        class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-4 pt-1.5 pb-7.5"
      >
        <slot />
      </main>
    </div>
    <template x-if="showExitModal">
      <ExitModal description={exitDescription} />
    </template>
    <template x-if="wakeLockDebug">
      <div
        class="pointer-events-none fixed inset-x-2 bottom-2 z-50 rounded bg-surface-overlay p-2 font-mono text-xs text-muted"
      >
        <template
          x-for="(line, index) in wakeLockLog"
          :key="index"
        >
          <div x-text="line"></div>
        </template>
      </div>
    </template>
  </div>
</BaseLayout>
```

- [ ] **Step 2: Rewrite `CountdownPauseControl.astro`.**

```astro
---
/**
 * The header's countdown pill for a MINUTES session, placed in
 * `GameLayout`'s `header-end` slot by the four countdown play pages. It
 * shows a pause icon and `remainingLabel()`, and a tap pauses. Resuming is
 * `CountdownResumePrompt`'s job, so the pill hides while paused. Reads
 * `remainingLabel()`, `togglePause()`, `hasActiveSession` and `finished` from
 * the play scope.
 */
interface Props {
  /** Alpine expression evaluating to a boolean; disables the pill. */
  disabledExpr: string;
}

// Props
const { disabledExpr }: Props = Astro.props;

// Components
import Button from "@components/forms/Button.astro";

// Icons
import PauseIcon from "@icons/pause.svg";
---

<Button
  type="button"
  variant="sheet-muted"
  ariaLabel="Pause timer"
  loadingExpr="false"
  class="h-11 shrink-0 gap-1.5 rounded-full px-3 py-0 font-mono text-[13px] font-medium text-foreground"
  :disabled={disabledExpr}
  @click="togglePause()"
  x-show="hasActiveSession && !finished && $store.game.configSnapshot?.durationType === 'MINUTES' && !$store.game.timerPaused"
  x-cloak
>
  <PauseIcon
    slot="iconBefore"
    class="size-3"
  />
  <span x-text="remainingLabel()"></span>
</Button>
```

- [ ] **Step 3: Rewrite `CountdownResumePrompt.astro`.**

```astro
---
/**
 * Resume affordance shown in place of the score/board input while a
 * MINUTES countdown is paused (#253): a round `glass-button` with an accent
 * play icon. It has the same `disabledExpr` contract as
 * `CountdownPauseControl`.
 */
interface Props {
  /** Alpine expression evaluating to a boolean; disables the resume button. */
  disabledExpr: string;
}

// Props
const { disabledExpr }: Props = Astro.props;

// Components
import Button from "@components/forms/Button.astro";

// Icons
import PlayIcon from "@icons/play-solid.svg";
---

<div
  class="flex min-h-0 flex-1 items-center justify-center"
  x-show="$store.game.timerPaused"
  x-cloak
>
  <Button
    type="button"
    variant="sheet-raised"
    icon
    ariaLabel="Resume timer"
    loadingExpr="false"
    class="size-24 rounded-full p-0"
    :disabled={disabledExpr}
    @click="togglePause()"
  >
    <PlayIcon
      slot="iconBefore"
      class="size-10 text-accent"
    />
  </Button>
</div>
```

- [ ] **Step 4: Remove the pause control from the four interfaces.** In `OneTwentyOne.astro`, `TenUpOneDown.astro`, `ScoreTraining.astro` and `AroundTheClock.astro`, delete the `import CountdownPauseControl …` line and the `<CountdownPauseControl … />` element. Keep `CountdownResumePrompt`.

- [ ] **Step 5: Play pages.** In each of the 11 pages, make two edits:
  - Replace the `<GameLayout …>` opening tag.
  - Change the first inner `<div class="flex flex-col flex-1 min-h-0 p-3" x-data="…" @confirm-exit.window="abandonAndExit()">` to `<div class="flex flex-col flex-1 min-h-0">`.

  The `x-data` and the listener move onto `<GameLayout>`. `title` stays as it is today.

  | Page | `gameTitle` | `x-data` | Pause control `disabledExpr` (none = no control) |
  | ---- | ----------- | -------- | ------------------------------------------------ |
  | `games/501/play` | `501` (delete `gameTitleExpr="matchTitle()"`) | `fiveOhOnePlay()` | none |
  | `games/121/play` | `121` | `oneTwentyOnePlay()` | `finished \|\| showDoubleConfirm \|\| showSessionFinishConfirm` |
  | `games/around-the-clock/play` | `Around the Clock` | `aroundTheClockPlay()` | `finished` |
  | `games/bobs27/play` | `Bob's 27` | `bobs27Play()` | none |
  | `games/cricket/play` | `Cricket` | `cricketPlay()` | none |
  | `games/doubles-training/play` | `Doubles` | `doublesTrainingPlay()` | none |
  | `games/score-training/play` | `Score training` | `scoreTrainingPlay()` | `finished \|\| showFinishConfirm` |
  | `games/shanghai/play` | `Shanghai` | `shanghaiPlay()` | none |
  | `games/singles-training/play` | `Singles` | `singlesTrainingPlay()` | none |
  | `games/tactics/play` | `Tactics` | `tacticsPlay()` | none |
  | `games/tuod/play` | `Ten Up One Down` | `tuodPlay()` | `finished \|\| showDoubleConfirm \|\| showFinishConfirm` |

  The 121 page after the edit (apply the same shape to every row):

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import OneTwentyOne from "@components/layout/games/interfaces/OneTwentyOne.astro";
import CountdownPauseControl from "@components/layout/games/CountdownPauseControl.astro";
import CheckoutConfirm from "@components/layout/games/CheckoutConfirm.astro";
import ConfirmDialog from "@components/ui/ConfirmDialog.astro";
import OneTwentyOneResults from "@components/layout/games/result-modals/OneTwentyOneResults.astro";
import NoSessionPanel from "@components/layout/games/NoSessionPanel.astro";
import ReconciliationBlocked from "@components/layout/games/ReconciliationBlocked.astro";
---

<GameLayout
  title="121 — Play"
  gameTitle="121"
  gameSubtitleExpr="subtitle()"
  x-data="oneTwentyOnePlay()"
  @confirm-exit.window="abandonAndExit()"
>
  <CountdownPauseControl
    slot="header-end"
    disabledExpr="finished || showDoubleConfirm || showSessionFinishConfirm"
  />
  <div class="flex flex-col flex-1 min-h-0">
    …unchanged body…
  </div>
</GameLayout>
```

  - Rows with "none" get no `CountdownPauseControl` import and no slot element.
  - Every page passes `gameSubtitleExpr="subtitle()"`.

- [ ] **Step 6: Training pages.** In `pages/training/routines/play/index.astro` and `pages/training/quick-subtract/index.astro`, change the inner div's class from `flex flex-col flex-1 min-h-0 p-3` to `flex flex-col flex-1 min-h-0`. Their `x-data` stays where it is, because their headers read only `$store`.

- [ ] **Step 7: Adding-a-game doc.** In `docs/architecture/07-Frontend/09-Adding-A-Game.md:86`, replace the row's description with:

  > Mounts `x-data="<codeSlug>Play()"` on `<GameLayout>` with `gameSubtitleExpr="subtitle()"`, so header expressions resolve in the play scope (D432). *Engine-only skips.*

- [ ] **Step 8: Delete `matchTitle` with its tests.**
  - Prove no caller remains: `grep -rn "matchTitle" src` must list only the definition in `five-oh-one-play.data.ts` and the line in `types.ts`.
  - Delete the `matchTitle` method and its JSDoc from `five-oh-one-play.data.ts`.
  - Delete `matchTitle(this: FiveOhOnePlayContext): string;` from `types.ts`.
  - Delete the whole `describe("matchTitle", …)` block from `five-oh-one-play.data.test.ts`. This is a removed subject, so the tests go with it and are not re-pointed.
  - Run `npm test -- tests/lib/game/five-oh-one-play.data.test.ts`, which must pass.
  - Run `grep -rn "matchTitle" src tests`, which must print nothing.

- [ ] **Step 9: Gates.** From `app/`:
  - `npx astro check --minimumFailingSeverity hint` must report 0/0/0.
  - `npm test` must be green.
  - `bash ../scripts/check-game-wiring.sh` must print OK. It still finds each page's `x-data` on `<GameLayout>`.
  - `bash ../scripts/check-astro-conventions.sh`, `bash ../scripts/check-astro-class-composition.sh` and `bash ../scripts/check-style-tokens.sh` must print OK.
  - Then check: `grep -rn 'x-data="[a-zA-Z]*Play()"' src/pages/games` prints exactly 11 lines, one per page. Each is the attribute under `<GameLayout`, and none is a `<div` line.

- [ ] **Step 10: Commit.**

```bash
git add src/layouts/GameLayout.astro src/components/layout/games/CountdownPauseControl.astro src/components/layout/games/CountdownResumePrompt.astro src/components/layout/games/interfaces src/pages/games src/pages/training/routines/play/index.astro src/pages/training/quick-subtract/index.astro ../docs/architecture/07-Frontend/09-Adding-A-Game.md src/lib/game/five-oh-one-play.data.ts src/lib/game/types.ts tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "feat(play): glass header with live subtitle and countdown pill

Removes matchTitle and its tests: its last caller was the header title (D432).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Scoreboards (solo card, stacked seats, stat tiles) and interface wiring

**Files:**
- Create:
  - `app/src/components/layout/games/PlayStatTile.astro`
  - `app/src/components/layout/games/RouteChips.astro`
  - `app/src/components/layout/games/LegBars.astro`
  - `app/src/components/layout/games/MarkRows.astro`
- Modify (whole files):
  - `app/src/components/layout/games/SinglePlayerDisplay.astro`
  - `app/src/components/layout/games/SplitScoreboard.astro`
  - `app/src/components/layout/games/SplitScoreboardHalf.astro`
  - all 11 `app/src/components/layout/games/interfaces/*.astro`
- Modify: `app/src/components/layout/training/trivia/QuickSubtract.astro:91` (delete the `fluid` attribute)
- Modify, deleting the orphaned getters:
  - `app/src/lib/game/around-the-clock-play.data.ts`: `hitsNeededLabel` (:380-389)
  - `app/src/lib/game/one-twenty-one-play.data.ts`: `dartsThrownThisSession`, `durationType` and `attemptLabel` (:428-442), and `dartsThrownCount` from the `play-visit-stats` import
  - `app/src/lib/game/types.ts`: their four context lines (:814-816, :1358)
- Test, deleting the getters' tests:
  - `app/tests/lib/game/around-the-clock-play.data.test.ts`: `it("shows hits needed under a 1/2/3-dart difficulty", …)` (:997-1007)
  - `app/tests/lib/game/one-twenty-one-play.data.test.ts`: the two `durationType` cases and the `attemptLabel` case (:970-998)

**Interfaces:**
- Consumes:
  - the magics `$bigValueSize`, `$seatValueSize` and `$legBarStates` (Task 2)
  - the utilities `glass-active-seat` and `pip-on` (Task 1)
  - getters from Tasks 4–6
- Produces:
  - `SinglePlayerDisplay`:
    - props `{ score?, target?, isTarget? = true, caption?, class? }`
    - slots `above`, `route`, default (right column) and `progress` (right column, after default; used by the training panels)
    - `label`, `size`, `fluid`, `activeExpr` and `pinnedHeight` are removed
  - `SplitScoreboard`:
    - props `{ seatA, seatB, idleStatLabel: string, legsToWinExpr?, class? }`
    - each seat is `{ nameExpr, activeExpr, scoreExpr, idleStatExpr, legsExpr?, checkoutExpr? }`
    - slots `progressA` and `progressB`
    - `isTarget` is removed
  - `SplitScoreboardHalf`: the same seat fields plus `idleStatLabel` and `legsToWinExpr`; default slot
  - `PlayStatTile`: `{ label: string; valueExpr: string; compact?: boolean }`
  - `RouteChips`: `{ routeExpr: string }`
  - `LegBars`: `{ wonExpr: string; toWinExpr: string }`
  - `MarkRows`: no props; it reads `objectiveRows()`
- Removes: Around the Clock's `hitsNeededLabel()` and 121's `dartsThrownThisSession()`, `durationType()` and `attemptLabel()`. Their last callers are the old interface stat rows, replaced in Step 9.

No unit test: markup only (D101).

- [ ] **Step 1: Create `PlayStatTile.astro`.**

```astro
---
/**
 * Inset stat in a play scoreboard. It shows the value over a mono caps
 * label in a 76px tile. With `compact`, it is one 44px row instead: label
 * left, value right (the active seat card's rows).
 * @param {string} label Caps label text
 * @param {string} valueExpr Alpine expression for the value
 * @param {boolean} [compact] Row layout for the active seat card
 */
interface Props {
  label: string;
  valueExpr: string;
  compact?: boolean;
}

// Props
const { label, valueExpr, compact = false }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn(
  "inset-well flex min-w-0",
  compact
    ? "h-11 shrink-0 items-center justify-between gap-2 rounded-[14px] px-3"
    : "h-[76px] flex-col-reverse items-center justify-center gap-1 rounded-xl px-2",
);
const labelClass = cn(
  "font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted",
  compact ? "min-w-0 truncate" : "text-center leading-tight",
);
const valueClass = cn(
  "shrink-0 font-mono font-medium tabular-nums text-foreground",
  compact ? "text-sm" : "text-[17px]",
);
---

<div class={className}>
  <span class={labelClass}>{label}</span>
  <span
    class={valueClass}
    x-text={valueExpr}
  ></span>
</div>
```

- [ ] **Step 2: Create `RouteChips.astro`.**

```astro
---
/**
 * Checkout route as a 28px `inset-well` pill: the route's parts in mono,
 * separated by 3px dots. Hidden while the route is blank.
 * @param {string} routeExpr Alpine expression for the route string ("T20 9 D16")
 */
interface Props {
  routeExpr: string;
}

// Props
const { routeExpr }: Props = Astro.props;
---

<div
  class="inset-well flex h-7 items-center gap-2 rounded-full px-3"
  x-show={routeExpr}
  x-cloak
>
  <template
    x-for={`(part, index) in (${routeExpr}).split(' ').filter(Boolean)`}
    :key="index"
  >
    <span class="flex items-center gap-2">
      <span
        class="size-[3px] rounded-full bg-faint-foreground"
        aria-hidden="true"
        x-show="index > 0"
        x-cloak
      ></span>
      <span
        class="font-mono text-[13px] text-soft-foreground"
        x-text="part"
      ></span>
    </span>
  </template>
</div>
```

- [ ] **Step 3: Create `LegBars.astro`.**

```astro
---
/**
 * One seat's legs: a 4px pill per leg to win on a 56px three-column grid,
 * accent once won. Above five legs it shows a mono `won/target` counter
 * instead (`legBarStates`, D432).
 * @param {string} wonExpr Alpine expression for legs won
 * @param {string} toWinExpr Alpine expression for legs to win
 */
interface Props {
  wonExpr: string;
  toWinExpr: string;
}

// Props
const { wonExpr, toWinExpr }: Props = Astro.props;

// Data
const statesExpr = `$legBarStates(${wonExpr}, ${toWinExpr})`;
const labelExpr = `'Legs won: ' + (${wonExpr}) + ' of ' + (${toWinExpr})`;
---

<div
  class="w-14"
  role="img"
  :aria-label={labelExpr}
>
  <template x-if={`${statesExpr} !== null`}>
    <div class="grid grid-cols-3 gap-1">
      <template
        x-for={`(leg, index) in ${statesExpr}`}
        :key="index"
      >
        <span
          class="h-1 rounded-full"
          :class="leg === 'won' ? 'bg-accent' : 'inset-well'"
        ></span>
      </template>
    </div>
  </template>
  <template x-if={`${statesExpr} === null`}>
    <span
      class="font-mono text-[10px] tabular-nums text-muted-foreground"
      x-text={`(${wonExpr}) + '/' + (${toWinExpr})`}
    ></span>
  </template>
</div>
```

- [ ] **Step 4: Create `MarkRows.astro`.**

```astro
---
/**
 * Cricket / Tactics mark rows for the solo scoreboard's right column: the
 * objective label, then three pips, one lit per mark. A closed row fades
 * to 50%. Reads `objectiveRows()` from the play page scope.
 */
---

<div class="flex min-h-0 flex-col justify-center gap-1">
  <template
    x-for="row in objectiveRows()"
    :key="row.objective"
  >
    <div
      class="flex items-center justify-between gap-2"
      role="img"
      :class="row.closed && 'opacity-50'"
      :aria-label="`${row.label}: ${row.marks} of 3 marks`"
    >
      <span
        class="text-[13px] font-medium text-foreground"
        x-text="row.label"
      ></span>
      <span class="flex gap-1">
        <template
          x-for="pip in [1, 2, 3]"
          :key="pip"
        >
          <span
            class="size-2.5 rounded-full"
            :class="pip <= row.marks ? 'pip-on' : 'inset-well'"
          ></span>
        </template>
      </span>
    </div>
  </template>
</div>
```

- [ ] **Step 5: Rewrite `SinglePlayerDisplay.astro`.**

```astro
---
/**
 * Solo play scoreboard: a `glass` card in the play screen's 40% band (D327).
 * The left column holds the big value, sized by length (`bigValueSize`),
 * an optional caption and route chips. The right column holds up to three
 * `PlayStatTile`s or `MarkRows` behind a hairline divider.
 * @param {string} [score] Alpine expression for the big value when `isTarget` is false
 * @param {string} [target] Alpine expression for the big value when `isTarget` is true
 * @param {boolean} [isTarget] Which of `target` / `score` drives the big value
 * @param {string} [caption] Mono eyebrow under the big value (e.g. "DARTS USED")
 * @param {string} [class] Extra classes
 * @slot above Over the big value
 * @slot route Under the big value — a `RouteChips`
 * @slot default Right column: stat tiles or mark rows
 * @slot progress Right column, after the default slot
 */
interface Props {
  score?: string;
  target?: string;
  isTarget?: boolean;
  caption?: string;
  class?: string;
}

// Props
const {
  score,
  target,
  isTarget = true,
  caption,
  class: classNameProp = "",
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Data
const valueExpr = isTarget ? target : score;

// Styles
const className = cn(
  "glass grid min-h-2/5 max-h-2/5 flex-1 grid-cols-[1.3fr_1fr] grid-rows-1 rounded-3xl p-5",
  classNameProp,
);
---

<div class={className}>
  <div class="flex min-w-0 flex-col items-center justify-center gap-2">
    <slot name="above" />
    <p
      class="whitespace-nowrap font-display leading-none tracking-[-0.02em] tabular-nums text-foreground text-shadow-glow"
      :class={`$bigValueSize(${valueExpr})`}
      x-text={valueExpr}
    >
    </p>
    {
      caption && (
        <span class="font-mono text-eyebrow font-semibold uppercase text-muted-foreground">
          {caption}
        </span>
      )
    }
    <slot name="route" />
  </div>
  <div
    class="flex min-h-0 min-w-0 flex-col justify-center gap-2 border-l border-white/8 pl-4"
  >
    <slot />
    <slot name="progress" />
  </div>
</div>
```

- [ ] **Step 6: Rewrite `SplitScoreboardHalf.astro`.**

```astro
---
/**
 * One seat inside `SplitScoreboard`. While `activeExpr` holds, it renders
 * the `glass-active-seat` card and moves to the top of the band. The card
 * has the name, `LegBars`, the score (`seatValueSize`) and the route chips
 * on the left, and compact stat rows right of a hairline. Otherwise it
 * renders a 64px `glass` row: name over `LegBars`, the muted score, and one
 * stat tile.
 * @param {string} nameExpr Alpine expr for the seat's display name
 * @param {string} activeExpr Alpine expr, true while this seat throws
 * @param {string} scoreExpr Alpine expr for the score
 * @param {string} idleStatExpr Alpine expr for the idle row's stat value
 * @param {string} idleStatLabel The idle row's stat label
 * @param {string} [legsExpr] Alpine expr for legs won; shown with `legsToWinExpr`
 * @param {string} [legsToWinExpr] Alpine expr for the leg target; omit to hide `LegBars`
 * @param {string} [checkoutExpr] Alpine expr for the route ("T20 9 D16"); omit to hide the chips
 * @slot default The active card's compact `PlayStatTile` rows
 */
interface Props {
  nameExpr: string;
  activeExpr: string;
  scoreExpr: string;
  idleStatExpr: string;
  idleStatLabel: string;
  legsExpr?: string;
  legsToWinExpr?: string;
  checkoutExpr?: string;
}

// Props
const {
  nameExpr,
  activeExpr,
  scoreExpr,
  idleStatExpr,
  idleStatLabel,
  legsExpr,
  legsToWinExpr,
  checkoutExpr,
}: Props = Astro.props;

// Components
import LegBars from "./LegBars.astro";
import RouteChips from "./RouteChips.astro";
---

<div
  class="flex min-h-0 flex-col"
  :class={`(${activeExpr}) ? 'order-first flex-1' : 'shrink-0'`}
>
  <div
    class="glass-active-seat grid min-h-0 flex-1 grid-cols-[1.3fr_1fr] grid-rows-1 rounded-[22px] px-[18px] py-4"
    x-show={activeExpr}
    x-cloak
  >
    <div class="flex min-w-0 flex-col justify-center gap-2">
      <span
        class="truncate text-sm font-semibold text-accent-bright"
        x-text={nameExpr}
      ></span>
      {
        legsExpr && legsToWinExpr && (
          <LegBars
            wonExpr={legsExpr}
            toWinExpr={legsToWinExpr}
          />
        )
      }
      <p
        class="whitespace-nowrap font-display leading-none tracking-[-0.02em] tabular-nums text-foreground text-shadow-glow"
        :class={`$seatValueSize(${scoreExpr})`}
        x-text={scoreExpr}
      >
      </p>
      {checkoutExpr && <RouteChips routeExpr={checkoutExpr} />}
    </div>
    <div
      class="flex min-h-0 min-w-0 flex-col justify-center gap-2 border-l border-white/8 pl-3"
    >
      <slot />
    </div>
  </div>
  <div
    class="glass flex h-16 items-center gap-3 rounded-[22px] pr-2.5 pl-4"
    x-show={`!(${activeExpr})`}
    x-cloak
  >
    <div class="flex min-w-0 flex-col gap-1.5">
      <span
        class="truncate text-sm font-semibold text-muted"
        x-text={nameExpr}
      ></span>
      {
        legsExpr && legsToWinExpr && (
          <LegBars
            wonExpr={legsExpr}
            toWinExpr={legsToWinExpr}
          />
        )
      }
    </div>
    <span
      class="ml-auto font-display text-2xl tabular-nums text-muted"
      x-text={scoreExpr}
    ></span>
    <div
      class="inset-well flex h-11 w-20 shrink-0 flex-col items-center justify-center rounded-[14px]"
    >
      <span
        class="font-mono text-[13px] tabular-nums text-foreground"
        x-text={idleStatExpr}
      ></span>
      <span
        class="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted"
      >
        {idleStatLabel}
      </span>
    </div>
  </div>
</div>
```

- [ ] **Step 7: Rewrite `SplitScoreboard.astro`.**

```astro
---
/**
 * Two-seat scoreboard in the play screen's 40% band (D327). Seats stack:
 * the throwing seat's card on top, the waiting seat's 64px row under it.
 * Each `SplitScoreboardHalf` swaps its own card and row on its `activeExpr`.
 * The markup is static, driven by the caller's Alpine expressions.
 * @param {object} seatA `{ nameExpr, activeExpr, scoreExpr, idleStatExpr, legsExpr?, checkoutExpr? }`
 * @param {object} seatB Same shape as `seatA`
 * @param {string} idleStatLabel Label of the idle row's stat (the game's first stat)
 * @param {string} [legsToWinExpr] Alpine expr for the leg target; omit to hide `LegBars`
 * @param {string} [class] Extra classes
 * @slot progressA Seat A's compact `PlayStatTile` rows
 * @slot progressB Seat B's compact `PlayStatTile` rows
 */
interface SeatDisplay {
  nameExpr: string;
  activeExpr: string;
  scoreExpr: string;
  idleStatExpr: string;
  legsExpr?: string;
  checkoutExpr?: string;
}

interface Props {
  seatA: SeatDisplay;
  seatB: SeatDisplay;
  idleStatLabel: string;
  legsToWinExpr?: string;
  class?: string;
}

// Props
const {
  seatA,
  seatB,
  idleStatLabel,
  legsToWinExpr,
  class: classNameProp = "",
}: Props = Astro.props;

// Components
import SplitScoreboardHalf from "./SplitScoreboardHalf.astro";

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn(
  "flex min-h-2/5 max-h-2/5 flex-1 flex-col gap-2",
  classNameProp,
);
---

<div class={className}>
  <SplitScoreboardHalf
    nameExpr={seatA.nameExpr}
    activeExpr={seatA.activeExpr}
    scoreExpr={seatA.scoreExpr}
    idleStatExpr={seatA.idleStatExpr}
    idleStatLabel={idleStatLabel}
    legsExpr={seatA.legsExpr}
    legsToWinExpr={legsToWinExpr}
    checkoutExpr={seatA.checkoutExpr}
  >
    <slot name="progressA" />
  </SplitScoreboardHalf>
  <SplitScoreboardHalf
    nameExpr={seatB.nameExpr}
    activeExpr={seatB.activeExpr}
    scoreExpr={seatB.scoreExpr}
    idleStatExpr={seatB.idleStatExpr}
    idleStatLabel={idleStatLabel}
    legsExpr={seatB.legsExpr}
    legsToWinExpr={legsToWinExpr}
    checkoutExpr={seatB.checkoutExpr}
  >
    <slot name="progressB" />
  </SplitScoreboardHalf>
</div>
```

- [ ] **Step 8: QuickSubtract.** Delete the `fluid` line from `<SinglePlayerDisplay>` in `QuickSubtract.astro`, because the prop no longer exists. The equation now sizes through `bigValueSize`, and any overflow is checked in Task 11. This is an adjacent edit.

- [ ] **Step 9: Interfaces.** Replace each file whole. All 11 share this frontmatter shape:
  - `interface Props { [key: string]: unknown; }`
  - `// Props` → `const { ...props }: Props = Astro.props;`
  - `// Components` imports

  The root is `<div class="flex flex-col flex-1 min-h-0 gap-2" {...props}>`. `StatRow` is no longer imported by any interface; it stays in use by the training panels.

`interfaces/FiveOhOne.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import RouteChips from "@components/layout/games/RouteChips.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay target="remainingScore()">
      <RouteChips
        slot="route"
        routeExpr="checkoutHint()"
      />
      <PlayStatTile
        label="Avg"
        valueExpr="average()"
      />
      <PlayStatTile
        label="Prev"
        valueExpr="previousScore()"
      />
      <PlayStatTile
        label="Darts"
        valueExpr="dartsThrownThisLeg()"
      />
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "remainingScoreFor(state()?.seats[0]?.participantRef)",
        legsExpr: "legsWonFor(state()?.seats[0]?.participantRef)",
        checkoutExpr: "checkoutHintFor(state()?.seats[0]?.participantRef)",
        idleStatExpr: "averageFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "remainingScoreFor(state()?.seats[1]?.participantRef)",
        legsExpr: "legsWonFor(state()?.seats[1]?.participantRef)",
        checkoutExpr: "checkoutHintFor(state()?.seats[1]?.participantRef)",
        idleStatExpr: "averageFor(state()?.seats[1]?.participantRef)",
      }}
      legsToWinExpr="legsToWin()"
      idleStatLabel="Avg"
    >
      <Fragment slot="progressA">
        <PlayStatTile
          compact
          label="Avg"
          valueExpr="averageFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Prev"
          valueExpr="previousScoreFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Darts"
          valueExpr="dartsThrownThisLegFor(state()?.seats[0]?.participantRef)"
        />
      </Fragment>
      <Fragment slot="progressB">
        <PlayStatTile
          compact
          label="Avg"
          valueExpr="averageFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Prev"
          valueExpr="previousScoreFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Darts"
          valueExpr="dartsThrownThisLegFor(state()?.seats[1]?.participantRef)"
        />
      </Fragment>
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showMatchFinishConfirm || finished"
    padDisabled="showDoubleConfirm || showMatchFinishConfirm || finished"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showMatchFinishConfirm || finished"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the keypad above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

`interfaces/OneTwentyOne.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import RouteChips from "@components/layout/games/RouteChips.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import CountdownResumePrompt from "@components/layout/games/CountdownResumePrompt.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay target="remainingInAttempt()">
      <RouteChips
        slot="route"
        routeExpr="checkoutHint()"
      />
      <PlayStatTile
        label="Target"
        valueExpr="currentTargetLabel()"
      />
      <PlayStatTile
        label="Visit"
        valueExpr="(visitsThisAttempt() + 1) + ' / 3'"
      />
      <PlayStatTile
        label="Darts"
        valueExpr="dartsThisAttempt()"
      />
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "remainingInAttemptFor(state()?.seats[0]?.participantRef)",
        checkoutExpr: "checkoutHintFor(state()?.seats[0]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "remainingInAttemptFor(state()?.seats[1]?.participantRef)",
        checkoutExpr: "checkoutHintFor(state()?.seats[1]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
      }}
      idleStatLabel="Target"
    >
      <Fragment slot="progressA">
        <PlayStatTile
          compact
          label="Target"
          valueExpr="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Visit"
          valueExpr="(visitsThisAttemptFor(state()?.seats[0]?.participantRef) + 1) + ' / 3'"
        />
        <PlayStatTile
          compact
          label="Darts"
          valueExpr="dartsThisAttemptFor(state()?.seats[0]?.participantRef)"
        />
      </Fragment>
      <Fragment slot="progressB">
        <PlayStatTile
          compact
          label="Target"
          valueExpr="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Visit"
          valueExpr="(visitsThisAttemptFor(state()?.seats[1]?.participantRef) + 1) + ' / 3'"
        />
        <PlayStatTile
          compact
          label="Darts"
          valueExpr="dartsThisAttemptFor(state()?.seats[1]?.participantRef)"
        />
      </Fragment>
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showSessionFinishConfirm || finished || $store.game.timerPaused"
    padDisabled="showDoubleConfirm || showSessionFinishConfirm || finished || $store.game.timerPaused"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showSessionFinishConfirm || finished || $store.game.timerPaused"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD' && !$store.game.timerPaused"
    x-cloak
  />
  {
    /* Visual board — shown instead of the keypad above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
  <CountdownResumePrompt
    disabledExpr="finished || showDoubleConfirm || showSessionFinishConfirm"
  />
</div>
```

`interfaces/TenUpOneDown.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import RouteChips from "@components/layout/games/RouteChips.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import CountdownResumePrompt from "@components/layout/games/CountdownResumePrompt.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay target="remainingInAttempt()">
      <RouteChips
        slot="route"
        routeExpr="checkoutHint()"
      />
      <PlayStatTile
        label="Target"
        valueExpr="currentTargetLabel()"
      />
      <PlayStatTile
        label="Attempts"
        valueExpr="attempts()"
      />
      <PlayStatTile
        label="Successes · Failures"
        valueExpr="successFailure()"
      />
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "remainingInAttemptFor(state()?.seats[0]?.participantRef)",
        checkoutExpr: "checkoutHintFor(state()?.seats[0]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "remainingInAttemptFor(state()?.seats[1]?.participantRef)",
        checkoutExpr: "checkoutHintFor(state()?.seats[1]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
      }}
      idleStatLabel="Target"
    >
      <Fragment slot="progressA">
        <PlayStatTile
          compact
          label="Target"
          valueExpr="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Attempts"
          valueExpr="attemptsFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Successes · Failures"
          valueExpr="successFailureFor(state()?.seats[0]?.participantRef)"
        />
      </Fragment>
      <Fragment slot="progressB">
        <PlayStatTile
          compact
          label="Target"
          valueExpr="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Attempts"
          valueExpr="attemptsFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Successes · Failures"
          valueExpr="successFailureFor(state()?.seats[1]?.participantRef)"
        />
      </Fragment>
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showFinishConfirm || finished || $store.game.timerPaused"
    padDisabled="showDoubleConfirm || showFinishConfirm || finished || $store.game.timerPaused"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showFinishConfirm || finished || $store.game.timerPaused"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD' && !$store.game.timerPaused"
    x-cloak
  />
  {
    /* Visual board — shown instead of the keypad above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
  <CountdownResumePrompt
    disabledExpr="finished || showDoubleConfirm || showFinishConfirm"
  />
</div>
```

`interfaces/ScoreTraining.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import CountdownResumePrompt from "@components/layout/games/CountdownResumePrompt.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={false}
      score="$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0).toLocaleString('en-US')"
    >
      <PlayStatTile
        label="Avg"
        valueExpr="threeDartAverage()"
      />
      <PlayStatTile
        label="Darts"
        valueExpr="dartsThrownThisLeg()"
      />
      <PlayStatTile
        label="Prev"
        valueExpr="previousScoreThisLeg()"
      />
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr:
          "totalScoreFor(state()?.seats[0]?.participantRef).toLocaleString('en-US')",
        idleStatExpr: "threeDartAverageFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr:
          "totalScoreFor(state()?.seats[1]?.participantRef).toLocaleString('en-US')",
        idleStatExpr: "threeDartAverageFor(state()?.seats[1]?.participantRef)",
      }}
      idleStatLabel="Avg"
    >
      <Fragment slot="progressA">
        <PlayStatTile
          compact
          label="Avg"
          valueExpr="threeDartAverageFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Darts"
          valueExpr="dartsThrownThisLegFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Prev"
          valueExpr="previousScoreThisLegFor(state()?.seats[0]?.participantRef)"
        />
      </Fragment>
      <Fragment slot="progressB">
        <PlayStatTile
          compact
          label="Avg"
          valueExpr="threeDartAverageFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Darts"
          valueExpr="dartsThrownThisLegFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Prev"
          valueExpr="previousScoreThisLegFor(state()?.seats[1]?.participantRef)"
        />
      </Fragment>
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showFinishConfirm || finished || $store.game.timerPaused"
    padDisabled="showFinishConfirm || finished || $store.game.timerPaused"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showFinishConfirm || finished || $store.game.timerPaused"
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD' && !$store.game.timerPaused"
    x-cloak
  />
  {
    /* Visual board — shown instead of the keypad above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
  <CountdownResumePrompt disabledExpr="finished || showFinishConfirm" />
</div>
```

`interfaces/AroundTheClock.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import SinglesRecreationalInput from "@components/layout/games/SinglesRecreationalInput.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import CountdownResumePrompt from "@components/layout/games/CountdownResumePrompt.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay target="currentTargetLabel()">
      <PlayStatTile
        label="Turns"
        valueExpr="turnsSoFar()"
      />
      <PlayStatTile
        label="Accuracy"
        valueExpr="accuracy()"
      />
      <template x-if="hitsToGo()">
        <PlayStatTile
          label="This visit"
          valueExpr="hitsToGo()"
        />
      </template>
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
        idleStatExpr: "turnsSoFarFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
        idleStatExpr: "turnsSoFarFor(state()?.seats[1]?.participantRef)",
      }}
      idleStatLabel="Turns"
    >
      <Fragment slot="progressA">
        <PlayStatTile
          compact
          label="Turns"
          valueExpr="turnsSoFarFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Accuracy"
          valueExpr="accuracyFor(state()?.seats[0]?.participantRef)"
        />
        <template x-if="hitsToGoFor(state()?.seats[0]?.participantRef)">
          <PlayStatTile
            compact
            label="This visit"
            valueExpr="hitsToGoFor(state()?.seats[0]?.participantRef)"
          />
        </template>
      </Fragment>
      <Fragment slot="progressB">
        <PlayStatTile
          compact
          label="Turns"
          valueExpr="turnsSoFarFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Accuracy"
          valueExpr="accuracyFor(state()?.seats[1]?.participantRef)"
        />
        <template x-if="hitsToGoFor(state()?.seats[1]?.participantRef)">
          <PlayStatTile
            compact
            label="This visit"
            valueExpr="hitsToGoFor(state()?.seats[1]?.participantRef)"
          />
        </template>
      </Fragment>
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD' && !$store.game.timerPaused"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
  <CountdownResumePrompt disabledExpr="finished" />
</div>
```

`interfaces/Bobs27.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import DoublesPathRecreationalInput from "@components/layout/games/DoublesPathRecreationalInput.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={false}
      score="currentScore()"
    >
      <PlayStatTile
        label="Target"
        valueExpr="currentTargetLabel()"
      />
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentScoreFor(state()?.seats[0]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentScoreFor(state()?.seats[1]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
      }}
      idleStatLabel="Target"
    >
      <PlayStatTile
        slot="progressA"
        compact
        label="Target"
        valueExpr="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
      />
      <PlayStatTile
        slot="progressB"
        compact
        label="Target"
        valueExpr="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
      />
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <VisitPreview />

  <DoublesPathRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

`interfaces/DoublesTraining.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import DoublesPathRecreationalInput from "@components/layout/games/DoublesPathRecreationalInput.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay target="currentTargetLabel()">
      <PlayStatTile
        label="Hits"
        valueExpr="hitCount()"
      />
      <PlayStatTile
        label="Misses"
        valueExpr="missCount()"
      />
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
        idleStatExpr: "hitCountFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
        idleStatExpr: "hitCountFor(state()?.seats[1]?.participantRef)",
      }}
      idleStatLabel="Hits"
    >
      <Fragment slot="progressA">
        <PlayStatTile
          compact
          label="Hits"
          valueExpr="hitCountFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Misses"
          valueExpr="missCountFor(state()?.seats[0]?.participantRef)"
        />
      </Fragment>
      <Fragment slot="progressB">
        <PlayStatTile
          compact
          label="Hits"
          valueExpr="hitCountFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Misses"
          valueExpr="missCountFor(state()?.seats[1]?.participantRef)"
        />
      </Fragment>
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <VisitPreview />

  <DoublesPathRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

`interfaces/Shanghai.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import SinglesRecreationalInput from "@components/layout/games/SinglesRecreationalInput.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={false}
      score="currentScore()"
    >
      <PlayStatTile
        label="Round"
        valueExpr="roundLabel()"
      />
      <PlayStatTile
        label="Target"
        valueExpr="currentTargetLabel()"
      />
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentScoreFor(state()?.seats[0]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentScoreFor(state()?.seats[1]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
      }}
      idleStatLabel="Target"
    >
      <Fragment slot="progressA">
        <PlayStatTile
          compact
          label="Round"
          valueExpr="roundLabelFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Target"
          valueExpr="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
        />
      </Fragment>
      <Fragment slot="progressB">
        <PlayStatTile
          compact
          label="Round"
          valueExpr="roundLabelFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Target"
          valueExpr="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
        />
      </Fragment>
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

`interfaces/SinglesTraining.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import SplitScoreboard from "@components/layout/games/SplitScoreboard.astro";
import PlayStatTile from "@components/layout/games/PlayStatTile.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import SinglesRecreationalInput from "@components/layout/games/SinglesRecreationalInput.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={false}
      score="currentPoints()"
    >
      <PlayStatTile
        label="Target"
        valueExpr="currentTargetLabel()"
      />
      <PlayStatTile
        label="Misses"
        valueExpr="missCount()"
      />
      <PlayStatTile
        label="S · D · T"
        valueExpr="singleCount() + ' · ' + doubleCount() + ' · ' + trebleCount()"
      />
    </SinglePlayerDisplay>
  </template>

  <template x-if="(state()?.seats.length ?? 1) >= 2">
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentPointsFor(state()?.seats[0]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentPointsFor(state()?.seats[1]?.participantRef)",
        idleStatExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
      }}
      idleStatLabel="Target"
    >
      <Fragment slot="progressA">
        <PlayStatTile
          compact
          label="Target"
          valueExpr="currentTargetLabelFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Misses"
          valueExpr="missCountFor(state()?.seats[0]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="S · D · T"
          valueExpr="singleCountFor(state()?.seats[0]?.participantRef) + ' · ' + doubleCountFor(state()?.seats[0]?.participantRef) + ' · ' + trebleCountFor(state()?.seats[0]?.participantRef)"
        />
      </Fragment>
      <Fragment slot="progressB">
        <PlayStatTile
          compact
          label="Target"
          valueExpr="currentTargetLabelFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="Misses"
          valueExpr="missCountFor(state()?.seats[1]?.participantRef)"
        />
        <PlayStatTile
          compact
          label="S · D · T"
          valueExpr="singleCountFor(state()?.seats[1]?.participantRef) + ' · ' + doubleCountFor(state()?.seats[1]?.participantRef) + ' · ' + trebleCountFor(state()?.seats[1]?.participantRef)"
        />
      </Fragment>
    </SplitScoreboard>
  </template>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

`interfaces/Cricket.astro` and `interfaces/Tactics.astro` are identical apart from the input import and element (`CricketRecreationalInput` / `TacticsRecreationalInput`). Here is `Cricket.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import MarkRows from "@components/layout/games/MarkRows.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import CricketRecreationalInput from "@components/layout/games/CricketRecreationalInput.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-2"
  {...props}
>
  <SinglePlayerDisplay
    isTarget={false}
    score="dartsThrown()"
    caption="DARTS USED"
  >
    <MarkRows />
  </SinglePlayerDisplay>

  <ErrorAlert class="mx-3 mt-2 text-xs" />

  <VisitPreview />

  <CricketRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap input above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

For `Tactics.astro`, take the same file and replace both `CricketRecreationalInput` occurrences (the import name and path, and the element) with `TacticsRecreationalInput`.

- [ ] **Step 10: Delete the orphaned getters with their tests.**
  - Prove no caller remains: `grep -rn "hitsNeededLabel\|dartsThrownThisSession\|attemptLabel\|durationType()" src` must list only the definitions in `around-the-clock-play.data.ts` and `one-twenty-one-play.data.ts`, plus their `types.ts` lines. No `.astro` file may appear.
  - In `around-the-clock-play.data.ts`, delete `hitsNeededLabel` and its JSDoc. In `types.ts`, delete `hitsNeededLabel(this: AroundTheClockPlayContext): string;`.
  - In `one-twenty-one-play.data.ts`:
    - delete `dartsThrownThisSession`, `durationType` and `attemptLabel`
    - drop `dartsThrownCount` from the `@lib/game/play-visit-stats` import, because it has no other use
    - keep `durationTypeOf`, `durationValueOf` and the `OneTwentyOneDurationType` import, which the countdown helpers still use
  - In `types.ts`, delete the `dartsThrownThisSession`, `durationType` and `attemptLabel` lines of `OneTwentyOnePlayContext`.
  - Tests. These are removed subjects, so the tests go with them and are not re-pointed:
    - In `around-the-clock-play.data.test.ts`, delete `it("shows hits needed under a 1/2/3-dart difficulty", …)`. The `hitsToGo` case added in Task 5 already pins the replacement guarantee.
    - In `one-twenty-one-play.data.test.ts`, delete `it("durationType reads TARGET for a 121_V1 session", …)`, `it("durationType reads the config for a 121_V2 session", …)` and `it("attemptLabel reads attemptsCompleted against duration_value", …)`.
    - Rename the surrounding `describe("durationType / attemptLabel / remainingLabel", …)` to `describe("remainingLabel", …)`. Its `remainingLabel` case stays.
  - Run `npm test -- tests/lib/game/around-the-clock-play.data.test.ts tests/lib/game/one-twenty-one-play.data.test.ts`, which must pass.
  - Run `grep -rn "hitsNeededLabel\|dartsThrownThisSession\|attemptLabel\|durationType()" src tests`, which must print nothing.

- [ ] **Step 11: Gates.** From `app/`:
  - `npx astro check --minimumFailingSeverity hint` must report 0/0/0. It catches every removed prop that is still passed.
  - `npm test` must be green.
  - `bash ../scripts/fallow-gate.sh` must print OK. If it reports health findings, simplify the named component.
  - `bash ../scripts/check-astro-conventions.sh`, `bash ../scripts/check-astro-class-composition.sh` and `bash ../scripts/check-style-tokens.sh` must print OK.
  - Nothing else is needed for removed props. `SinglePlayerDisplay` and `SplitScoreboard` declare no index signature, so `astro check` flags any caller still passing `label`, `size`, `fluid`, `activeExpr`, `pinnedHeight` or `isTarget`.

- [ ] **Step 12: Commit.**

```bash
git add src/components/layout/games src/components/layout/training/trivia/QuickSubtract.astro src/lib/game/around-the-clock-play.data.ts src/lib/game/one-twenty-one-play.data.ts src/lib/game/types.ts tests/lib/game/around-the-clock-play.data.test.ts tests/lib/game/one-twenty-one-play.data.test.ts
git commit -m "feat(play): glass scoreboards — stat tiles, stacked seats, leg bars, mark rows

Removes hitsNeededLabel, attemptLabel, durationType and dartsThrownThisSession with their tests: their last callers were the old stat rows (D432).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Keys, keypad, tap inputs and visit strip

**Files:**
- Modify (whole files), all in `app/src/components/layout/games/`:
  - `InputButton.astro`
  - `ScoreInput.astro`
  - `SinglesRecreationalInput.astro`
  - `DoublesPathRecreationalInput.astro`
  - `CricketRecreationalInput.astro`
  - `TacticsRecreationalInput.astro`
  - `VisitPreview.astro`

**Interfaces:**
- Consumes:
  - the utilities `input-well`, `key-press`, `target-key-ring` and `next-dart-ring` (Task 1)
  - the magics `$ringKeyActive` and `$previewColumnState` (Task 2)
- Produces:
  - `InputButton` props `{ type?, variant?: "well" | "muted" | "target", pressedExpr?: string, class?, …attrs }`
  - `ScoreInput` props unchanged

No unit test: markup only (D101).

- [ ] **Step 1: Rewrite `InputButton.astro`.**

```astro
---
/**
 * One key on a play input: mono 26px at `rounded-key`, with the accent
 * inset ring while pressed (`key-press`) and 35% when disabled. A key has
 * one surface: `variant` picks the well, or `pressedExpr` swaps
 * `glass-blue` / `inset-well` for a ring key.
 * @param {"button"|"submit"|"reset"} [type]
 * @param {"well"|"muted"|"target"} [variant] `muted` for icon keys (undo, delete); `target` rings the doubles-path target
 * @param {string} [pressedExpr] Alpine expression; while true the key is `glass-blue` and `aria-pressed`
 * @param {string} [class] Extra classes
 */
interface Props {
  class?: string;
  type?: "button" | "submit" | "reset";
  variant?: "well" | "muted" | "target";
  pressedExpr?: string;
  [key: string]: unknown;
}

// Props
const {
  class: classNameProp = "",
  type = "button",
  variant = "well",
  pressedExpr,
  ...props
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Data
const pressedAttrs = pressedExpr
  ? {
      ":class": `(${pressedExpr}) ? 'glass-blue' : 'inset-well'`,
      ":aria-pressed": pressedExpr,
    }
  : {};

// Styles
const surfaceClass = {
  well: "inset-well",
  muted: "inset-well-muted",
  target: "target-key-ring",
}[variant];

const className = cn(
  "key-press flex min-h-0 w-full items-center justify-center rounded-key px-0 font-mono text-[26px] font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-35",
  !pressedExpr && surfaceClass,
  classNameProp,
);
---

<button
  type={type}
  class={className}
  {...pressedAttrs}
  {...props}
>
  <slot />
</button>
```

- [ ] **Step 2: Rewrite `ScoreInput.astro`.** Keep the `interface Props` and the `// Props` block exactly as they are today, and replace the rest:

```astro
---
/**
 * Visit-score keypad in an `input-well`: the entry row (value, then a raised
 * Submit), a hairline, then a 3×4 key grid of 1–9, then undo, 0 and delete.
 * The parent supplies the Alpine expressions and owns the buffer and the
 * game rules.
 * @param {string} value Alpine expr for the buffered digits
 * @param {string} digitHandler Alpine function, called as `handler(digit, $event)`
 * @param {string} onDelete Alpine expr for delete
 * @param {string} onSubmit Alpine expr for submit
 * @param {string} [submitDisabled] Alpine expr; defaults to an empty buffer
 * @param {string} [padDisabled] Alpine expr disabling the digit and delete keys
 * @param {string} [undoClick] Alpine expr for undo; omit for an inert key
 * @param {string} [undoDisabled] Alpine expr disabling undo
 * @param {string} [class] Extra classes
 */
interface Props {
  value: string;
  digitHandler: string;
  onDelete: string;
  onSubmit: string;
  submitDisabled?: string;
  padDisabled?: string;
  undoClick?: string;
  undoDisabled?: string;
  class?: string;
  [key: string]: unknown;
}

// Props
const {
  value,
  digitHandler,
  onDelete,
  onSubmit,
  submitDisabled = `!${value}`,
  padDisabled,
  undoClick,
  undoDisabled = "true",
  class: classNameProp,
  ...props
}: Props = Astro.props;

// Components
import InputButton from "./InputButton.astro";
import Button from "@components/forms/Button.astro";

// Icons
import DeleteIcon from "@icons/delete.svg";
import UndoIcon from "@icons/undo.svg";

// Lib
import { cn } from "@client/cn";

// Data
const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const padAttrs = padDisabled ? { ":disabled": padDisabled } : {};

// Styles
const rootClass = cn("input-well flex flex-col", classNameProp);
---

<div
  class={rootClass}
  {...props}
>
  <div
    class="inset-well flex shrink-0 items-center gap-2 rounded-[22px] py-[5px] pr-[5px] pl-5"
  >
    <span
      class="min-w-0 flex-1 truncate font-mono text-[30px] font-medium tabular-nums"
      :class={`(!${value} || ${value} === '0') ? 'text-placeholder' : 'text-foreground'`}
      x-text={`${value} || '0'`}
    ></span>
    <Button
      type="button"
      variant="sheet-raised"
      title="Submit"
      class="h-12 w-[110px] shrink-0 rounded-[17px]"
      {...{ ":disabled": submitDisabled, "x-on:click": onSubmit }}
    />
  </div>
  <div
    class="h-px shrink-0 bg-white/8"
    aria-hidden="true"
  >
  </div>
  <div class="grid min-h-0 flex-1 auto-rows-fr grid-cols-3 gap-2">
    {
      digits.map((digit) => (
        <InputButton
          {...{
            "x-on:click": `${digitHandler}(${digit}, $event)`,
            ...padAttrs,
          }}
        >
          {digit}
        </InputButton>
      ))
    }
    {
      undoClick ? (
        <InputButton
          variant="muted"
          aria-label="Undo last visit"
          {...{ "x-on:click": undoClick, ":disabled": undoDisabled }}
        >
          <UndoIcon class="size-6 text-muted-foreground" />
        </InputButton>
      ) : (
        <InputButton
          variant="muted"
          aria-hidden="true"
          {...{ ":disabled": "true" }}
        />
      )
    }
    <InputButton
      {...{ "x-on:click": `${digitHandler}(0, $event)`, ...padAttrs }}
    >
      0
    </InputButton>
    <InputButton
      variant="muted"
      aria-label="Delete last digit"
      {...{ "x-on:click": onDelete, ...padAttrs }}
    >
      <DeleteIcon class="size-6 text-muted-foreground" />
    </InputButton>
  </div>
</div>
```

- [ ] **Step 3: Rewrite `SinglesRecreationalInput.astro`.**

```astro
---
/**
 * Tap input for a single-number target, in an `input-well`. Row 1 holds the
 * S/D/T keys for the current number, or BULL / BULLSEYE on the bull. Row 2
 * holds undo and MISS. Reads `isBullVisit()`, `currentTargetLabel()`,
 * `recordTap()`, `undoVisit()` and `finished` from the play scope.
 */
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import InputButton from "./InputButton.astro";

// Icons
import UndoIcon from "@icons/undo.svg";
---

<div
  class="input-well flex flex-col"
  {...props}
>
  <div class="flex min-h-0 flex-1 gap-2">
    <template x-if="!isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('SINGLE')"
      >
        <span x-text="'S' + currentTargetLabel()"></span>
      </InputButton>
    </template>
    <template x-if="!isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('DOUBLE')"
      >
        <span x-text="'D' + currentTargetLabel()"></span>
      </InputButton>
    </template>
    <template x-if="!isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('TREBLE')"
      >
        <span x-text="'T' + currentTargetLabel()"></span>
      </InputButton>
    </template>
    <template x-if="isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('SINGLE')"
      >
        BULL
      </InputButton>
    </template>
    <template x-if="isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('DOUBLE')"
      >
        BULLSEYE
      </InputButton>
    </template>
  </div>
  <div class="flex min-h-0 flex-1 gap-2">
    <InputButton
      variant="muted"
      aria-label="Undo last dart"
      :disabled="!$store.game.turns.length || finished"
      @click="undoVisit()"
    >
      <UndoIcon class="size-6 text-muted-foreground" />
    </InputButton>
    <InputButton
      class="text-[22px] tracking-[0.08em] text-soft-foreground"
      :disabled="finished"
      @click="recordTap('MISS')"
    >
      MISS
    </InputButton>
  </div>
</div>
```

- [ ] **Step 4: Rewrite `DoublesPathRecreationalInput.astro`.**

```astro
---
/**
 * Doubles-path tap row in an `input-well`: undo, MISS, and the current
 * target ringed in accent (`target-key-ring`). Reads `currentTargetLabel()`,
 * `recordTap()`, `undoVisit()` and `finished` from the play scope.
 */
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import InputButton from "./InputButton.astro";

// Icons
import UndoIcon from "@icons/undo.svg";
---

<div
  class="input-well grid grid-cols-3"
  {...props}
>
  <InputButton
    variant="muted"
    aria-label="Undo last dart"
    :disabled="!$store.game.turns.length || finished"
    @click="undoVisit()"
  >
    <UndoIcon class="size-6 text-muted-foreground" />
  </InputButton>
  <InputButton
    class="text-[22px] tracking-[0.08em] text-soft-foreground"
    :disabled="finished"
    @click="recordTap(false)"
  >
    MISS
  </InputButton>
  <InputButton
    variant="target"
    :disabled="finished"
    @click="recordTap(true)"
    x-text="currentTargetLabel()"
  />
</div>
```

- [ ] **Step 5: Rewrite `CricketRecreationalInput.astro`.**

```astro
---
/**
 * Cricket's tap input in an `input-well`. Row 1: undo, then the S/D/T ring
 * keys. S clears D/T; the armed key is `glass-blue` (`ringKeyActive`).
 * Row 2: the seven objectives and MISS on a four-column grid. Treble
 * cannot apply to the bull, so BULL is disabled while T is armed.
 */
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import InputButton from "./InputButton.astro";

// Icons
import UndoIcon from "@icons/undo.svg";
---

<div
  class="input-well flex flex-col"
  {...props}
>
  <div class="grid min-h-0 flex-1 grid-cols-4 gap-2">
    <InputButton
      variant="muted"
      aria-label="Undo last dart"
      :disabled="!$store.game.turns.length || finished"
      @click="undoVisit()"
    >
      <UndoIcon class="size-6 text-muted-foreground" />
    </InputButton>
    <InputButton
      pressedExpr="$ringKeyActive(ring, 'S')"
      :disabled="finished"
      @click="setRing('SINGLE')"
    >
      S
    </InputButton>
    <InputButton
      pressedExpr="$ringKeyActive(ring, 'D')"
      :disabled="finished"
      @click="setRing('DOUBLE')"
    >
      D
    </InputButton>
    <InputButton
      pressedExpr="$ringKeyActive(ring, 'T')"
      :disabled="finished"
      @click="setRing('TREBLE')"
    >
      T
    </InputButton>
  </div>
  <div class="grid min-h-0 flex-[2] auto-rows-fr grid-cols-4 gap-2">
    <template
      x-for="row in objectiveRows()"
      :key="row.objective"
    >
      <InputButton
        class="text-2xl uppercase"
        :disabled="finished || (row.objective === 25 && ring === 'TREBLE')"
        @click="recordObjective(row.objective)"
        x-text="row.label"
      />
    </template>
    <InputButton
      class="text-2xl text-soft-foreground"
      :disabled="finished"
      @click="recordMiss()"
    >
      MISS
    </InputButton>
  </div>
</div>
```

- [ ] **Step 6: Rewrite `TacticsRecreationalInput.astro`.**

```astro
---
/**
 * Tactics' tap input in an `input-well`. Row 1: undo, then the S/D/T ring
 * keys. S clears D/T; the armed key is `glass-blue` (`ringKeyActive`).
 * Row 2: `tapTargets()` and MISS — four columns on a single (20–15, Bull),
 * seven once D or T is armed and 14…1 join. Treble cannot apply to the
 * bull, so BULL is disabled while T is armed.
 */
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import InputButton from "./InputButton.astro";

// Icons
import UndoIcon from "@icons/undo.svg";
---

<div
  class="input-well flex flex-col"
  {...props}
>
  <div class="grid min-h-0 flex-1 grid-cols-4 gap-2">
    <InputButton
      variant="muted"
      aria-label="Undo last dart"
      :disabled="!$store.game.turns.length || finished"
      @click="undoVisit()"
    >
      <UndoIcon class="size-6 text-muted-foreground" />
    </InputButton>
    <InputButton
      pressedExpr="$ringKeyActive(ring, 'S')"
      :disabled="finished"
      @click="setRing('SINGLE')"
    >
      S
    </InputButton>
    <InputButton
      pressedExpr="$ringKeyActive(ring, 'D')"
      :disabled="finished"
      @click="setRing('DOUBLE')"
    >
      D
    </InputButton>
    <InputButton
      pressedExpr="$ringKeyActive(ring, 'T')"
      :disabled="finished"
      @click="setRing('TREBLE')"
    >
      T
    </InputButton>
  </div>
  <div
    class="grid min-h-0 flex-[2] auto-rows-fr gap-2"
    :class="$ringKeyActive(ring, 'S') ? 'grid-cols-4' : 'grid-cols-7'"
  >
    <template
      x-for="target in tapTargets()"
      :key="target.number"
    >
      <InputButton
        class="text-2xl uppercase"
        :disabled="finished || (target.number === 25 && ring === 'TREBLE')"
        @click="recordTarget(target.number)"
        x-text="target.label"
      />
    </template>
    <InputButton
      class="text-2xl text-soft-foreground"
      :disabled="finished"
      @click="recordMiss()"
    >
      MISS
    </InputButton>
  </div>
</div>
```

- [ ] **Step 7: Rewrite `VisitPreview.astro`.**

```astro
---
/**
 * The open visit's three darts as a `glass` strip. Each column has an 18px
 * header (HIT with a check, MISS with a cross, or DART n) over a 6px bar:
 * accent for a hit, white/22 for a miss, a well for an empty dart. The
 * next dart's bar takes `next-dart-ring` (`previewColumnState`). Reads
 * `previewSegments()` from the play scope.
 */
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Icons
import CheckIcon from "@icons/check.svg";
import CrossIcon from "@icons/cross.svg";
---

<div
  class="glass grid shrink-0 grid-cols-3 gap-2 rounded-[22px] px-[18px] py-3"
  {...props}
>
  <template
    x-for="(column, index) in $previewColumnState(previewSegments())"
    :key="index"
  >
    <div class="flex min-w-0 flex-col gap-1.5">
      <div
        class="flex h-[18px] items-center font-mono text-eyebrow font-semibold uppercase"
      >
        <template x-if="column.status === 'hit'">
          <span class="flex items-center gap-1 text-accent">
            <CheckIcon class="size-3.5" />
            HIT
          </span>
        </template>
        <template x-if="column.status === 'miss'">
          <span class="flex items-center gap-1 text-muted">
            <CrossIcon class="size-3" />
            MISS
          </span>
        </template>
        <template x-if="column.status === 'empty'">
          <span
            :class="column.next ? 'text-soft-foreground' : 'text-faint-foreground'"
            x-text="'DART ' + (index + 1)"
          ></span>
        </template>
      </div>
      <span
        class="h-1.5 rounded-full"
        :class="column.status === 'hit' ? 'bg-accent' : column.status === 'miss' ? 'bg-white/22' : column.next ? 'next-dart-ring' : 'inset-well'"
      ></span>
    </div>
  </template>
</div>
```

- [ ] **Step 8: Gates.** From `app/`:
  - `npx astro check --minimumFailingSeverity hint` must report 0/0/0.
  - `npm test` must be green.
  - `bash ../scripts/fallow-gate.sh` must print OK. `ScoreInput.astro` keeps its existing `maxCrap: 60` override. A new breach means simplifying, not raising the override.
  - `bash ../scripts/check-astro-conventions.sh`, `bash ../scripts/check-astro-class-composition.sh` and `bash ../scripts/check-style-tokens.sh` must print OK.

- [ ] **Step 9: Commit.**

```bash
git add src/components/layout/games/InputButton.astro src/components/layout/games/ScoreInput.astro src/components/layout/games/SinglesRecreationalInput.astro src/components/layout/games/DoublesPathRecreationalInput.astro src/components/layout/games/CricketRecreationalInput.astro src/components/layout/games/TacticsRecreationalInput.astro src/components/layout/games/VisitPreview.astro
git commit -m "feat(play): inset keys with accent press, input wells, visit strip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Board panel and magnifier (Analytics)

**Files:**
- Modify:
  - `app/src/components/layout/games/BoardInputPanel.astro` (the doc comment's last paragraph and the markup)
  - `app/src/components/ui/BoardMagnifier.astro` (doc :5-7 and :14-16, `circleClass`, the read `<p>`)
  - `app/src/lib/game/board-input.data.ts`. Delete:
    - `MAGNIFIER_LABEL_GAP` and `magnifierLabelStyle` (:34-49)
    - `magnifierLabel` in `BoardInputDataContext` (:107)
    - the factory method `magnifierLabel` (:228-230)
- Test: `app/tests/lib/game/board-input.data.test.ts`. Delete the `magnifierLabelStyle` import (:6) and its doc comment plus its two cases (:417-431).

**Interfaces:**
- Consumes:
  - `InputButton` `variant="muted"` (Task 9)
  - `input-well`, `board-dim` and `shadow-magnifier` (Task 1)
- Removes: `magnifierLabelStyle` and the factory's `magnifierLabel()`. This is a subject removal with its tests, recorded in D432 (root CLAUDE.md test-removal rule).

- [ ] **Step 1: Remove the tests with their subject.** In `board-input.data.test.ts`:
  - Delete `magnifierLabelStyle,` from the import list.
  - Delete the JSDoc block starting "The circle is centred on the anchor origin…", together with `it("prints above the circle's top edge, gap-adjusted", …)` and `it("stays snug to the anchor origin before a press sets a real size", …)`.

- [ ] **Step 2: Remove the subject.** In `board-input.data.ts`, delete:
  - the `MAGNIFIER_LABEL_GAP` constant and its comment
  - the exported `magnifierLabelStyle` and its JSDoc
  - the line `magnifierLabel(this: BoardInputDataContext): string;`
  - the method `magnifierLabel(this: BoardInputDataContext): string { return magnifierLabelStyle(this.board); },`

- [ ] **Step 3: Run, expect PASS.**
  - `npm test -- tests/lib/game/board-input.data.test.ts` must pass.
  - `grep -rn "magnifierLabel" src tests` must show only `BoardMagnifier.astro`, which is fixed in Step 4.

- [ ] **Step 4: `BoardMagnifier.astro`.**
  - In the doc comment, change "…plus the resolved read above it." to "…with the resolved read in a pill inside the circle's bottom edge (D432)."
  - In the binding list, change `magnifierAnchor()`, `magnifierBox()`, `magnifierBoard()`, `magnifierLabel()`, `magnifierRead()` to `magnifierAnchor()`, `magnifierBox()`, `magnifierBoard()`, `magnifierRead()`.
  - Replace the `circleClass` with:

    ```ts
    const circleClass = cn(
      "absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-accent bg-surface shadow-magnifier",
      classNameProp,
    );
    ```

  - Delete the outer `<p class="glass absolute left-0 … " :style="magnifierLabel()" x-text="magnifierRead()">`.
  - Add the read as the last child *inside* the circle `<div class={circleClass} …>`, after the two crosshair divs:

```astro
    <p
      class="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 font-mono text-[11px] font-semibold leading-normal text-foreground"
      x-show="magnifierRead()"
      x-cloak
      x-text="magnifierRead()"
    >
    </p>
```

- [ ] **Step 5: `BoardInputPanel.astro`.**
  - In the doc comment, replace the last paragraph (from "`touch-none` on the pointer surface…" to "…(#131).") with:

    > `touch-none` on the pointer surface stops the browser turning a drag into a scroll or a pinch, so `pointermove` keeps arriving for the whole gesture. The board area is a `flex-1 min-h-0` row of the panel's `input-well` column. The pointer surface is `h-full max-w-full aspect-square`, so the board sizes off the height the play screen leaves it, clamped to the width, with no viewport-relative number (#131). While a press is live, the board takes `board-dim` and a 44px ring marks the pointer. Both sit beside the magnifier, never on its ancestors: a `filter` on an ancestor becomes the containing block of the `fixed` magnifier and breaks its placement.

  - Replace the markup and imports. The `// Components` imports become `DartBoard`, `BoardMagnifier` and `InputButton`; `Button` is dropped. `// Icons` keeps `UndoIcon`.

```astro
<div
  x-show="!finished && !$store.game.timerPaused && hasActiveSession && $store.game.inputModeKey === 'VISUAL_BOARD'"
  x-cloak
  class="input-well flex flex-col items-center"
>
  <div class="flex min-h-0 w-full flex-1 items-center justify-center">
    <div
      class="relative aspect-square h-full max-w-full touch-none"
      @pointerdown="onPointerDown($event)"
      @pointermove="onPointerMove($event)"
      @pointerup="onPointerUp()"
      @pointercancel="onPointerCancel()"
    >
      <DartBoard
        boardRef="board"
        class="transition-[filter] duration-150 ease-out"
        :class="board.active && 'board-dim'"
      >
        <div
          class="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <template
            x-for="marker in visitMarkers()"
            :key="marker.sequence"
          >
            <span
              class="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
              :style="`left: ${marker.leftPercent}%; top: ${marker.topPercent}%`"
            >
            </span>
          </template>
        </div>
      </DartBoard>
      <span
        class="pointer-events-none fixed z-10 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/12 ring-1 ring-white/25"
        aria-hidden="true"
        x-show="board.active"
        x-cloak
        :style="{ left: pointerX + 'px', top: pointerY + 'px' }"
      ></span>
      <BoardMagnifier />
    </div>
  </div>

  <div class="grid h-14 w-full shrink-0 grid-cols-2 gap-2">
    <InputButton
      variant="muted"
      aria-label="Undo dart"
      :disabled="!$store.game.turns.length"
      @click="undoVisit()"
    >
      <UndoIcon class="size-6 text-muted-foreground" />
    </InputButton>
    <InputButton
      class="font-sans text-[15px] font-medium"
      @click="recordUnseen()"
    >
      Bounce out
    </InputButton>
  </div>
</div>
```

  The press ring's `:style` is the object form on purpose. It shares its element with `x-show`, and the string form would wipe `display: none` (D199, #159).

- [ ] **Step 6: Gates.** From `app/`:
  - `npx astro check --minimumFailingSeverity hint` must report 0/0/0.
  - `npm test` must be green.
  - `bash ../scripts/fallow-gate.sh`, `bash ../scripts/check-astro-conventions.sh`, `bash ../scripts/check-style-tokens.sh` and `bash ../scripts/check-test-coverage.sh` must print OK. The test-coverage gate passes because `board-input.data.ts` and its test changed together.

- [ ] **Step 7: Commit.**

```bash
git add src/components/layout/games/BoardInputPanel.astro src/components/ui/BoardMagnifier.astro src/lib/game/board-input.data.ts tests/lib/game/board-input.data.test.ts
git commit -m "feat(play): board dims on press, magnifier read inside the circle

Removes magnifierLabelStyle and its tests: the read no longer sits above the circle (D432 supersedes D204's placement).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Docs, decision, discovered work, visual check, finish

**Files:**
- Modify:
  - `docs/architecture/07-Frontend/07-Style-Guide.md`
  - `docs/architecture/07-Frontend/08-Component-Inventory.md`
  - `decisions/frontend/style.md`: append D432
  - `docs/architecture/00-File-Inventory.md`: a new section, plus two row updates
  - `docs/architecture/00-Context-Map-History.md` and `00-Context-Map.md`, through the `context-maintenance` skill
  - `docs/superpowers/specs/2026-10-08-game-play-redesign-design.md`: the status line only

- [ ] **Step 1: Full validation.** Run the `validate-app` skill (`npm run validate:app`). Every step must exit 0, and the type gate must report 0/0/0. Fix any failure in the owning task's files and commit it as `fix(play): …`.

- [ ] **Step 2: Style Guide.** Make targeted edits only. Leave the stale D199 accessibility line (:243) to #837.
  - **Version (:10).** Change it to `0.4.0 (2026-10-08 — game play: play surfaces, key press, play header, stacked seats, D432; prior 0.3.1 was login, D431)`. Set the front-matter `updated: 2026-10-08`.
  - **Tokens table, Surfaces row (:45).** Append: `; play (D432): `glass-active-seat` (throwing seat card), `input-well` (input panels), `next-dart-ring` (next dart's bar), `target-key-ring` (doubles target key), `pip-on` (lit mark pip), `board-dim` (board while pressed), `shadow-magnifier``.
  - **Primitives table.** Add a row after `.field-inset`:
    `| `@utility glass-active-seat` / `input-well` / `key-press` / `next-dart-ring` / `target-key-ring` / `pip-on` / `board-dim` | Play screens: accent-tinted seat card; glass input panel well; accent inset ring on a pressed key; next-dart and doubles-target rings (each carries its own well background — never stack on `inset-well`); lit mark pip; dimmed board while pressing (design Game Play, D432, 2026-10-08) |`
  - **Press-feedback sentence (:115).** Append: ` Keys (`InputButton`) are the exception: `key-press` draws an accent inset ring on `:active` (120ms box-shadow) instead of the scale (D432).`
  - **Typography row "Large numeric displays" (:126).** Replace its rule cell with: `font-display` (Michroma) `leading-none tracking-[-0.02em] tabular-nums text-shadow-glow`; size from `bigValueSize` on the solo card (84 / 64 / 46px by length) and `seatValueSize` on the active seat card (64 / 46px) (D432, replaces D262's `fluid`).
  - **Spacing & layout.** After the band paragraph (:150), add:
    `**Play header.** `GameLayout` renders a 56px `glass` pill (6px padding, `gap-2`): a 44px `inset-well-muted` exit, the `font-display` 14px title with an optional mono `text-eyebrow` subtitle, and the `header-end` slot in a 44px box. The play column below is padded `6px 16px 30px` with `gap-2`. A play page mounts its `x-data` on `<GameLayout>` so header expressions resolve in the play scope (D432).`
  - **Band paragraph (:150).** Replace its last two sentences, from "It is owned by…" to the end, with:
    `It is owned by the two shells, not by call sites: `SinglePlayerDisplay.astro` and `SplitScoreboard.astro` both apply it. `SplitScoreboard` stacks the seats inside it — the throwing seat's `glass-active-seat` card on top, the waiting seat's 64px row under it. A play screen passes no height class of its own (D327, D432).`
  - **Motion table (:196).** Change "Rely on `.btn:active`'s built-in press scale" to "Rely on `.btn:active`'s press scale, or `key-press` on keys". Add a row:
    `| `board-dim` may transition `filter` (150ms) — the one non-transform/opacity transition, scoped to the board while a press is live (D432) | Transitioning `filter` elsewhere |`
  - **Container-queries paragraph (:260).** Replace the sentence "`SinglePlayerDisplay`'s `fluid` prop is the existing example (D262) — reach for it before hand-rolling a new container-query block." with "No shared component uses one today; play-screen big values step by length instead (`bigValueSize`, D432)."

- [ ] **Step 3: Component Inventory.** Make targeted row edits. Set the front-matter `updated: 2026-10-08`.
  - **`components/ui/`, `BoardMagnifier.astro` (:28).** The purpose becomes "Zoomed board detail follows the pointer during visual capture; accent rim, `shadow-magnifier`, the read in a pill inside the circle (D432)".
  - **`components/layout/`.** Add:
    `| `GameLayout.astro` (`app/src/layouts/`) | Play-screen shell: 56px `glass` header pill (exit, display title, live subtitle, `header-end` slot) over the padded play column; leftover attributes (the page's play `x-data`, `@confirm-exit.window`) land on the header+main wrapper (D432) | `title`, `gameTitle`, `gameTitleExpr`, `gameSubtitleExpr`, `exitDescription`, slot `header-end` |`
  - **`components/layout/games/`.** Replace these rows:
    - `BoardInputPanel.astro`: "Visual-board capture in an `input-well`: square board that dims while pressed (`board-dim`) under a 44px pointer ring, then an undo / Bounce out key row; shown instead of the keypad for `ANALYTICS` + `VISUAL_BOARD` (D432)" | none (reads `boardInputData()` from the page scope)
    - `CountdownPauseControl.astro`: "Header countdown pill (`GameLayout` `header-end`): pause icon + `remainingLabel()`; hidden while paused, finished or without a session (D432)" | `disabledExpr` (reads `remainingLabel()`/`togglePause()`/`hasActiveSession`/`finished` from the play scope)
    - `CountdownResumePrompt.astro`: "Round `glass-button` with an accent play icon, shown in place of the score/board input while `$store.game.timerPaused` (#253; restyled D432)" | `disabledExpr` (reads `togglePause()` from the page scope)
    - `DoublesPathRecreationalInput.astro`: "Doubles-path tap row in an `input-well`: undo, MISS, the target key (`target-key-ring`) (D432)" | none
    - `CricketRecreationalInput.astro`: "Cricket's DETAILED_DARTS input in an `input-well`: undo and S/D/T ring keys (S clears D/T; the armed key `glass-blue`), then the seven objectives and MISS on a four-column grid; Treble off on Bull; one tap records one dart (2026-10-06; D432)" | none (reads the Cricket page scope: `ring`, `setRing`, `recordObjective`, `recordMiss`, `objectiveRows`)
    - `TacticsRecreationalInput.astro`: "Tactics' DETAILED_DARTS input in an `input-well`: undo and S/D/T ring keys, then `tapTargets()` and MISS — four columns on a single (20–15, Bull), seven once D/T adds 14…1; Treble off on Bull (2026-10-06; D432)" | none (reads the Tactics page scope: `ring`, `setRing`, `recordTarget`, `recordMiss`, `tapTargets`)
    - `InputButton.astro`: "One play key: `inset-well`, `rounded-key`, mono 26px, `key-press` accent ring, 35% when disabled (D432)" | `type`, `variant` (`well`/`muted`/`target`), `pressedExpr` (`glass-blue` + `aria-pressed` while true)
    - `ScoreInput.astro`: "Numeric keypad in an `input-well`: entry row with a `sheet-raised` Submit, a hairline, a 3×4 key grid (D432)" | same props as today
    - `SinglePlayerDisplay.astro`: "Solo play scoreboard: `glass` card in the 40% band; big value sized by `bigValueSize`, optional caption and route chips on the left, stat tiles or mark rows on the right (D432)" | `score`, `target`, `isTarget`, `caption`; slots `above`, `route`, default, `progress`
    - `SinglesRecreationalInput.astro`: "Target-aware S/D/T or BULL/BULLSEYE row over undo + MISS, in an `input-well` (D432)" | none
    - `SplitScoreboard.astro`: "Two-seat scoreboard in the 40% band: the throwing seat's `glass-active-seat` card on top, the waiting seat's 64px row under it (D432)" | `seatA`, `seatB` (each `{ nameExpr, activeExpr, scoreExpr, idleStatExpr, legsExpr?, checkoutExpr? }`), `idleStatLabel`, `legsToWinExpr`, named slots `progressA`/`progressB`
    - `SplitScoreboardHalf.astro`: "One seat in `SplitScoreboard`: the active card (name, `LegBars`, score by `seatValueSize`, `RouteChips`, compact stat rows) or the idle row (name, `LegBars`, muted score, one stat tile), swapped on `activeExpr` (D432)" | `nameExpr`, `activeExpr`, `scoreExpr`, `idleStatExpr`, `idleStatLabel`, `legsExpr`, `legsToWinExpr`, `checkoutExpr`; default slot = the active card's rows
    - `VisitPreview.astro`: "Three-dart `glass` strip for the open visit: HIT / MISS / DART n header over a 6px bar, the next dart ringed (`previewColumnState`); every adopter builds its `previewSegments()` via the shared `playPreviewSegments()` (Pattern 19; restyled D432)" | none
  - **Add rows (alphabetical within the table):**
    - `| `LegBars.astro` | One seat's legs: a 4px pill per leg to win (accent once won), or a mono `won/target` counter above five legs (`legBarStates`, D432) | `wonExpr`, `toWinExpr` |`
    - `| `MarkRows.astro` | Cricket/Tactics mark rows: label + three pips (`pip-on`), closed rows at 50%, `aria-label` per row (D432) | none (reads `objectiveRows()`) |`
    - `| `PlayStatTile.astro` | Inset play stat: value over a mono caps label in a 76px tile, or a 44px label/value row with `compact` (D432) | `label`, `valueExpr`, `compact` |`
    - `| `RouteChips.astro` | Checkout route as a 28px `inset-well` pill of mono parts split by dots; hidden while blank (D432) | `routeExpr` |`

- [ ] **Step 4: Decision.**
  - Confirm the id with `bash scripts/next-decision-id.sh`, which must print 432. If 432 is taken, use `bash scripts/renumber-decision.sh` afterwards.
  - Append to `decisions/frontend/style.md`:

```markdown
### D432 — Game play follows the design: glass header, stacked seats, inset keys
Status: Accepted · Date: 2026-10-08
Decision: every `/games/*/play` screen follows Claude Design `Game Play Recreational.dc.html` / `Game Play Analytics.dc.html`, in place in the shared shells so all 11 games inherit it. `GameLayout` is a 56px `glass` header pill (exit, display title, live `gameSubtitleExpr`, `header-end` slot); each play page mounts its `x-data` on `<GameLayout>` so header expressions resolve in the play scope. Solo: a `glass` card with the big value sized by length (`bigValueSize`) and up to three `PlayStatTile`s or `MarkRows`. Multi-seat (every game with a second seat): the throwing seat's `glass-active-seat` card above the waiting seat's 64px row, with `LegBars` — one bar per leg to win up to 5, a `won/target` counter above. Keys are `InputButton`s with the `key-press` accent ring instead of a scale; panels sit in `input-well`; the visit strip rings the next dart. Analytics mode keeps the board alone, no keypad (D201); the existing SVG board dims while pressed; the magnifier keeps its placement (D199) and shows its read in a pill inside the circle. Cricket/Tactics get an S key that clears D/T — no new ring state; Tactics' 14…1 stay available once D/T is armed. The timer is a header pill on the four countdown games; the paused state keeps `CountdownResumePrompt`. Every subtitle and stat comes from engine or config data via a tested `subtitle()` per factory, in the setup wording (`ORDER_MODE_LABELS` now shared from `lib/game/play-subtitle.ts`). Training screens inherit only through the shared parts.
Reason: one restyle of shared shells and inputs reaches all 11 games; values from data keep the design's sample numbers out of the app.
Consequences: `magnifierLabelStyle` and the factory's `magnifierLabel()` are removed with their tests; the play getters left without a caller are removed with their tests — `matchTitle` (501), `hitsNeededLabel` (Around the Clock, replaced by `hitsToGo`), and `attemptLabel`, `durationType` and `dartsThrownThisSession` (121); `SplitScoreboardHalf`'s legs badge and dot pager are removed; `SinglePlayerDisplay` drops `label`, `size`, `fluid`, `activeExpr` and `pinnedHeight` (gains `caption` and a `route` slot). `.astro` carries no unit test (D101); helpers in `lib/ui/play-display.ts` and `lib/game/play-subtitle.ts` and every new getter are tested; CSS is pinned in `brand-tokens.test.ts`. Deferred (GitHub issues): paused-state design, results modals, training-screen gaps; stale Style Guide keypad line (#837).
Supersedes: D204 (read placement only — now inside the circle); D262 (`fluid` replaced by `bigValueSize`).
```

  - Run `bash scripts/check-decision-ids.sh`, which must print OK.

- [ ] **Step 5: File Inventory.** In `docs/architecture/00-File-Inventory.md`:
  - After the "Game setup redesign (2026-10-08)" table, add:

```markdown
## Game play redesign (2026-10-08)

| File | Answers | Status |
| ---- | ------- | ------ |
| `app/src/components/layout/games/PlayStatTile.astro` | Inset play stat: value over a caps label in a 76px tile, or a 44px label/value row with `compact` (D432, 2026-10-08) | canonical |
| `app/src/components/layout/games/RouteChips.astro` | Checkout route as a 28px `inset-well` pill of mono parts split by dots (D432, 2026-10-08) | canonical |
| `app/src/components/layout/games/LegBars.astro` | Legs-won pills per leg to win up to five, else a `won/target` counter (D432, 2026-10-08) | canonical |
| `app/src/components/layout/games/MarkRows.astro` | Cricket/Tactics mark rows with three `pip-on` pips, closed rows faded (D432, 2026-10-08) | canonical |
| `app/src/lib/ui/play-display.ts` | `bigValueSize`, `seatValueSize`, `legBarStates`, `previewColumnState`, `ringKeyActive`, exposed as Alpine magics (D432, 2026-10-08) | canonical |
| `app/src/lib/game/play-subtitle.ts` | `ORDER_MODE_LABELS` (shared with the setup forms), `joinSubtitle`, `orderModeLabel` (D432, 2026-10-08) | canonical |
```

  - Update the `app/src/lib/ui/types.ts` row to `lib/ui` type barrel (`SliderTick`; `LegBarState`, `PreviewStatus`, `PreviewColumn`, `TapRing`, `RingKey` — D432), raised by `lib/types.ts` (2026-10-08).
  - Append to the `07-Frontend/08-Component-Inventory.md` row's change list: `; `PlayStatTile`/`RouteChips`/`LegBars`/`MarkRows`/`GameLayout` rows added, play shells and inputs restyled (D432, 2026-10-08)`.

- [ ] **Step 6: Spec status.** In the spec's first metadata line, change `**Status:** approved` to `**Status:** implemented`.

- [ ] **Step 7: Discovered work.** Run the `capturing-discovered-work` skill once per item. Use title `[Discovered] …` and labels `discovered-work`, `type:<type>` and `severity:<severity>`. Body: the skill's format, with Discovery Context `feat/game-play-redesign`, 2026-10-08.
  1. **Paused countdown state has no design.** Type `ui`, severity `low`.
     - Claim: the spec restyles `CountdownResumePrompt` only.
     - Evidence: `app/src/components/layout/games/CountdownResumePrompt.astro` was styled ad hoc (D432), and the spec §2 says the paused state has no design.
  2. **Results modals are not in the game-play design.** Type `ui`, severity `low`.
     - Evidence: `app/src/components/layout/games/result-modals/*.astro` keep the D429 sheet look, and the spec lists them as out of scope.
  3. **Training screens inherit the play restyle with layout gaps.** Type `ui`, severity `medium`. Evidence:
     - The exercise panels (`app/src/components/layout/training/exercises/*Panel.astro`) pass `StatRow` lists into `SinglePlayerDisplay`'s right column and lost the default "Score" caption.
     - `ExerciseBoardInputPanel.astro` has no `input-well`, `board-dim` or press ring.
     - Quick Subtract's equation is sized by `bigValueSize` (46px for 4+ characters) and may clip.
     - The routine play page.
     - Also list whatever the visual pass in Step 10 shows.
  4. Anything else noticed during Tasks 1–10.

  Record the issue numbers for the PR body. #837 (the stale keypad accessibility line) already exists and is only referenced.

- [ ] **Step 8: Context maintenance and gates.**
  - Run the `context-maintenance` skill. It covers the CLAUDE.md sync, the context map version bump, and a new `00-Context-Map-History.md` entry at the top of Version History. That entry is:
    `> **Version:** 1.178.0 (2026-10-08 — Game play redesign: D432 in `decisions/frontend/style.md`; `07-Style-Guide.md` 0.4.0 play surfaces, key press, play header and stacked-seat band; `08-Component-Inventory.md` gains `PlayStatTile`/`RouteChips`/`LegBars`/`MarkRows`/`GameLayout`, play shell and input rows updated; `09-Adding-A-Game.md` play page mounts `x-data` on `GameLayout`; new File Inventory section "Game play redesign"; spec `docs/superpowers/specs/2026-10-08-game-play-redesign-design.md`, plan `docs/superpowers/plans/2026-10-08-game-play-redesign.md`.)`
    The skill also covers the decision ledger and the graph note. Use 1.178.0 unless `main` has moved past 1.177.0; in that case take the next minor.
  - Run the `run-all-gates` skill. Every script must report OK or PASS, `check-doc-sync.sh` included.
  - Run `cd app && npm run format && npm run format:check`.

- [ ] **Step 9: Commit the docs.**

```bash
git add docs/architecture decisions/frontend/style.md docs/superpowers/specs/2026-10-08-game-play-redesign-design.md
git commit -m "docs(play): D432, style guide, component and file inventory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

  Commit any `npm run format` diff separately as `chore(format): …`.

- [ ] **Step 10: Visual check (handed to the user).** No headless browser is available in this sandbox, so do not claim a visual pass. Put this checklist in the PR body, unticked, and ask the user to run it with `cd app && npm run dev` at a 390×844 viewport. Each game is checked in both Recreational and Analytics mode, switched in Settings.
  - **121 (keypad):**
    - header title `121` and subtitle `ATTEMPT n · 9 DARTS`
    - three tiles; route chips
    - Submit is raised; keys show the accent ring on press, with no scale
    - MINUTES: the pill shows the time, tapping pauses, the resume button replaces the keypad, and the pill hides while paused
  - **Singles (tap):** the `LOW → HIGH` / `RANDOM ORDER` subtitle; the S7/D7/T7 row; undo + MISS; BULL / BULLSEYE on the bull.
  - **Doubles (doubles path):** the target key ringed; the visit strip moves `next` dart by dart; `DART n` greys.
  - **Cricket:** the `DARTS USED` caption; 7 mark rows with pips, closed rows faded; S lit by default; D/T toggle `glass-blue`; BULL disabled under T. **Tactics:** 9 rows, and 7 columns once D/T is armed.
  - **501 with a bot:**
    - the active card is on top and swaps when the bot throws
    - leg bars per leg to win; the idle row shows Avg
    - a 4-character active-seat score fits; check Score training 1v1 past 1,000
  - **Analytics on any board game:**
    - no keypad
    - the board dims while pressed, with a 44px ring under the finger
    - the magnifier follows with its read in a pill inside the circle
    - Bounce out / undo row
  - **Inherited screens:** a routine exercise panel, routine play, and Quick Subtract. Add their gaps to issue 3.
  - **Exit button:** opens the sheet; Leave game abandons.
  - **A page with no session:** `NoSessionPanel` shows, with no subtitle and no pill.

- [ ] **Step 11: Finish.** Run `superpowers:finishing-a-development-branch` with the `finishing-a-dart-branch` skill: Option 2, push and open a PR. The PR body lists:
  - the discovered-work issue numbers
  - #837
  - the Step 10 checklist, unticked
  - the plan-time amendments
