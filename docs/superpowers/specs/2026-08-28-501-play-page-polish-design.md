# 501: play-page polish (Issue #167, Part A) — Design

Status: Approved · Date: 2026-08-28

## Problem

Issue #167 ("UI: 501") bundles five reports. Brainstorming split it into two
parts (see the sibling spec for Part B, the match-summary rework). This part
covers the small, low-risk play-page fixes:

1. **Leg dots.** In 1v1, `SplitScoreboardHalf.astro`'s leg/round dot pager
   renders under each seat's score, duplicating the leg-wins pill already
   shown above the number. Remove it.
2. **Static title.** The play page's header always reads "501", regardless of
   how many legs the match is configured for. Replace it with "First to N
   legs" (N = the session's configured `legsToWin`), updating live if a
   future task adds sets.
3. **"Previous" label.** `FiveOhOne.astro`'s progress stats read "Previous
   score" — already fixed from the reported "Precious score" typo, but the
   user asked to drop the word "score" too: it should read "Previous".
4. **Checkout-confirm buttons.** `CheckoutConfirm.astro`'s footer stacks
   Confirm above Cancel (`flex-col`). Every other confirm dialog in the app
   puts them side by side, cancel left / confirm right. Match that.

## Scope

In scope: `app/src/components/layout/games/interfaces/FiveOhOne.astro`,
`app/src/components/layout/games/CheckoutConfirm.astro`,
`app/src/layouts/GameLayout.astro`, `app/src/pages/games/501/play/index.astro`,
`app/src/lib/game/five-oh-one-play.data.ts`, `app/src/lib/game/types.ts`.

Out of scope: `SplitScoreboardHalf.astro`/`SplitScoreboard.astro` themselves
(the dot pager is dead code for every other game already — see Design §1),
the match-summary modal (Part B), any engine change.

## Design

### 1. Remove the leg dot pager

`legsToWinExpr` is the only thing that turns the dot pager on
(`SplitScoreboardHalf.astro`'s `x-show={legsToWinExpr}` block), and
`FiveOhOne.astro` is the only caller in the codebase that passes it — every
other game's `SplitScoreboard` call omits it. Deleting the one line that
passes `legsToWinExpr="$store.game.configSnapshot?.legsToWin"` in
`FiveOhOne.astro`'s `SplitScoreboard` call hides the pager with no change to
the shared component. The leg-wins pill (`legsExpr`, the `Badge` above the
score) is untouched — the issue asks only to remove the dot row.

`SplitScoreboardHalf.astro`/`SplitScoreboard.astro` keep the `legsToWinExpr`
prop rather than deleting the plumbing: it is a documented, intentional
"omit to hide" optional feature (`08-Component-Inventory.md`), not
provably-dead code — a future game could reuse it.

### 2. Dynamic match title

`GameLayout.astro`'s `gameTitle` prop is a static, build-time string —
there is no Alpine-reactive path to a page header today. Add a sibling prop:

```ts
interface Props {
  title?: string;
  gameTitle?: string;
  /** Alpine expression string, evaluated live; takes precedence over `gameTitle` when set. */
  gameTitleExpr?: string;
}
```

Render `gameTitleExpr` via `x-text` when present, else fall back to the
existing static `gameTitle` branch, else render nothing — the same
three-way shape `Button.astro`/`StatRow.astro` already use for
expression-vs-literal props elsewhere in the codebase. No other page passes
`gameTitleExpr`; every other `GameLayout` caller is unaffected.

`five-oh-one-play.data.ts` gains one new method:

```ts
matchTitle(this: FiveOhOnePlayContext): string {
  const legsToWin = this.$store.game.configSnapshot?.legsToWin;
  return legsToWin ? `First to ${legsToWin} legs` : "501";
}
```

`FiveOhOnePlayContext` (`types.ts`) declares `matchTitle(): string`.
`pages/games/501/play/index.astro` swaps `gameTitle="501"` for
`gameTitleExpr="matchTitle()"`. The header's `uppercase` CSS class already
renders any string in caps, so "First to 5 legs" displays as "FIRST TO 5
LEGS" — consistent with every other game's all-caps title, no casing logic
needed in the string itself.

The `"501"` fallback covers the instant before `configSnapshot` loads
(matches every other `*For`-style accessor's `?? default` convention in this
file). When a future task adds sets, `matchTitle()` is the one place that
changes — the design deliberately keeps the whole computation in this one
function so that's a targeted edit, not a template change.

### 3. "Previous" label

Both `StatRow label="Previous score"` occurrences in `FiveOhOne.astro`
(solo and each 1v1 seat slot) become `label="Previous"`. Markup-only, no
data-layer change — the bound value expression (`previousScore()` /
`previousScoreFor(...)`) is untouched.

### 4. Checkout-confirm button row

`CheckoutConfirm.astro`'s footer changes from:

```astro
<div slot="footer" class="mt-6 flex flex-col gap-3">
  <Button variant="primary" title="Confirm" @click="confirmDouble()" :disabled="..." />
  <Button variant="ghost" title="Cancel" @click="cancelCheckout()" />
</div>
```

to the same shape `ConfirmDialog.astro`'s action row already uses elsewhere
in the app (`07-Style-Guide.md`'s documented convention: cancel left/ghost,
confirm right/primary, `justify-end gap-3`, each button `w-1/3`):

```astro
<div slot="footer" class="mt-6 flex justify-end gap-3">
  <Button variant="ghost" class="w-1/3" title="Cancel" @click="cancelCheckout()" />
  <Button variant="primary" class="w-1/3" title="Confirm" @click="confirmDouble()" :disabled="..." />
</div>
```

No behavior change — same two handlers, same disabled condition, only
layout and left-to-right order change.

## Testing (TDD, mandatory)

- `five-oh-one-play.data.test.ts`: new case(s) for `matchTitle()` — returns
  `"501"` before a session loads (no `configSnapshot`), and
  `"First to 5 legs"` once `configSnapshot.legsToWin` is 5 (and another value
  to prove it isn't hardcoded).
- No test for `GameLayout.astro`'s new prop, `FiveOhOne.astro`'s label
  change, or `CheckoutConfirm.astro`'s footer — all three are markup/branching
  logic with no new computation, exempt under D101 (no Astro-component test
  runner exists).

## Context maintenance

Per root `CLAUDE.md`, run `context-maintenance` before completion:

- `08-Component-Inventory.md`: `GameLayout.astro` isn't in this table (it's a
  layout, not a `components/` entry) — no row to update. Note the new
  `gameTitleExpr` prop only if a future pass adds layouts to that inventory.
- No new decision needed — this is template/prop-plumbing, not a new
  architectural rule.
- Run `run-all-gates` and confirm every applicable script passes.
