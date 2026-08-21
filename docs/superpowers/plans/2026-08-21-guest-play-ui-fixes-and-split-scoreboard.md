# Guest-Play UI Fixes + Split Scoreboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three shipped defects on 501's guest-add setup UI (faint dashed outline, backwards icon sizing, missing 1v1 cap), ban the Tailwind important modifier repo-wide, and build a shared two-seat split scoreboard proven end-to-end on 501 — the only engine that can reach 2 seats today.

**Architecture:** `Button.astro` gains a `dashed` variant so the add-guest control renders through the shared primitive instead of override classes. A repo-wide gate (`check-style-tokens.sh`) is extended to ban `!utility` and `utility!` alike, forcing every override through `cn()`'s merge ordering or a primitive's own variant/prop surface. A new `SplitScoreboard.astro` + `SplitScoreboardHalf.astro` pair wraps the existing `SinglePlayerDisplay.astro` per seat; `five-oh-one-play.data.ts` grows seat-parameterized siblings of its existing derived getters, and `FiveOhOne.astro` branches on `state().seats.length` to pick single vs. split rendering.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Tailwind v4, Vitest.

## Global Constraints

- Every source `.ts` change under `app/src/` needs a covering test change (`scripts/check-test-coverage.sh`, D224) — type-only edits and `.astro` markup are exempt (D101).
- No `!important` modifier anywhere in `app/src/**/*.{astro,css}` — neither prefix (`!utility`) nor suffix (`utility!`) — as of this plan's Task 2. Compose overrides through `cn()`'s merge ordering or extend the primitive's variant/prop surface.
- A standalone action always renders through `components/forms/Button.astro` — never a raw `<button>` (`app/CLAUDE.md`).
- Every `x-show` needs `x-cloak` on the same element (`scripts/check-astro-conventions.sh`).
- Semantic tokens only (`accent`/`surface`/`foreground`/`muted*`) — never raw palette utilities.
- Format with `cd app && npm run format` and confirm `npm run format:check` before any commit that touches `.astro`/`.ts`.
- Run `bash scripts/check-style-tokens.sh`, `bash scripts/check-astro-conventions.sh`, and `cd app && npm run validate:app` before claiming any task done (per `validate-app` / `run-all-gates` skills).
- Decisions are append-only: never edit `decisions/frontend/style.md`'s existing D175 block — a reversal is a new block citing `Supersedes: D175`.

**Out of scope for this plan:** wiring `SplitScoreboard` into the other 8 engines (Bobs27, OneTwentyOne, Shanghai, AroundTheClock, TenUpOneDown, SinglesTraining, DoublesTraining, ScoreTraining). None of their setup screens can add a guest yet (deferred, tracked in `DECISIONS.md`'s Deferred list), so none can reach 2 seats today — this plan's Task 3 proves the shared shell against the one engine that can. A follow-up plan wires the remaining 8 once this lands, one task per engine, following the exact pattern Task 3 establishes.

---

## Task 1: Setup-page fixes — dashed button, icon sizing, 1v1 cap

**Files:**
- Modify: `app/src/components/forms/Button.astro`
- Modify: `app/src/components/layout/games/setup/AddGuestButton.astro`
- Modify: `app/src/components/layout/games/setup/GuestSection.astro`
- Modify: `app/src/lib/game/five-oh-one-setup.data.ts:101-107` (`addGuest`)
- Test: `app/tests/lib/game/five-oh-one-setup.data.test.ts`

**Interfaces:**
- Consumes: `cn()` from `@client/cn` (existing, unchanged signature `cn(...classValues) => string`).
- Produces: `Button.astro`'s `variant` prop accepts a new literal `"dashed"` alongside the existing `"primary" | "secondary" | "ghost" | "error"`. Later tasks (and the follow-up 8-engine plan) can reuse this variant unchanged.

- [ ] **Step 1: Write the failing test for the 1v1 guest cap**

Add to `app/tests/lib/game/five-oh-one-setup.data.test.ts`, right after the existing `"removeGuest splices the correct entry"` test (around line 189):

```ts
  it("addGuest refuses a second guest once one already exists", () => {
    const setup = createSetup({
      showAddGuestModal: true,
      newGuestName: "Sam",
      guests: [{ displayName: "Alex" }],
    });

    setup.addGuest();

    expect(setup.guests).toEqual([{ displayName: "Alex" }]);
    expect(setup.newGuestName).toBe("Sam");
    expect(setup.showAddGuestModal).toBe(true);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts -t "addGuest refuses a second guest"`
Expected: FAIL — `setup.guests` has length 2 (`Alex`, `Sam`), not 1, because `addGuest()` has no cap yet.

- [ ] **Step 3: Add the guard to `addGuest()`**

In `app/src/lib/game/five-oh-one-setup.data.ts`, change:

```ts
    addGuest(this: FiveOhOneSetupContext) {
      const name = this.newGuestName.trim();
      if (!name) return;
      this.guests.push({ displayName: name });
      this.newGuestName = "";
      this.showAddGuestModal = false;
    },
```

to:

```ts
    addGuest(this: FiveOhOneSetupContext) {
      if (this.guests.length >= 1) return;
      const name = this.newGuestName.trim();
      if (!name) return;
      this.guests.push({ displayName: name });
      this.newGuestName = "";
      this.showAddGuestModal = false;
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: PASS, all tests in the file green (including the new one).

- [ ] **Step 5: Add the `dashed` variant to `Button.astro`**

In `app/src/components/forms/Button.astro`, update the `Props` interface and `variantClasses`:

```ts
interface Props {
  type?: "button" | "submit" | "reset";
  title?: string;
  variant?: "primary" | "secondary" | "ghost" | "error" | "dashed";
  icon?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  class?: string;
  /** Alpine expression evaluating to a boolean; controls the built-in spinner. */
  loadingExpr?: string;
  [key: string]: unknown;
}
```

and in the JSDoc above it, update `@param {"primary"|"secondary"|"ghost"|"error"} [variant]` to `@param {"primary"|"secondary"|"ghost"|"error"|"dashed"} [variant]`.

```ts
const variantClasses = {
  primary: "border-transparent bg-white text-black btn-primary",
  secondary: "border-border text-foreground btn-secondary",
  ghost: "text-muted-foreground btn-ghost",
  error: "bg-error text-error-foreground btn-error",
  dashed: "border-accent border-dashed bg-transparent text-muted-foreground",
}[variant];
```

- [ ] **Step 6: Rewrite `AddGuestButton.astro`**

Replace the whole file with:

```astro
---
// Components
import Button from "@components/forms/Button.astro";

// Icons
import PlusIcon from "@icons/plus.svg";
---

<div
  class="flex flex-col gap-1 items-center justify-center"
  x-show="guests.length < 1"
  x-cloak
>
  <Button
    type="button"
    variant="dashed"
    icon
    ariaLabel="Add guest"
    @click="showAddGuestModal = true"
    class="rounded-full p-3 border-6"
  >
    <PlusIcon
      class="size-8"
      slot="iconBefore"
    />
  </Button>
  <span
    class="text-sm invisible"
    aria-hidden="true"
  >
    &nbsp;
  </span>
</div>
```

(`x-show="guests.length < 3"` → `x-show="guests.length < 1"` for the 1v1 cap; the dashed circle now renders through the new `Button` variant with `border-6`/`border-accent` full opacity and no `!` anywhere; `PlusIcon` drops the now-redundant `text-muted-foreground` since the `dashed` variant already sets `text-muted-foreground` on the button, which the icon inherits via `currentColor` — same visual result as before.)

- [ ] **Step 7: Rewrite the remove badge in `GuestSection.astro`**

In `app/src/components/layout/games/setup/GuestSection.astro`, replace the `<Button>` block (lines 30-42):

```astro
    <Button
      type="button"
      variant="ghost"
      icon
      :aria-label="`Remove ${g.displayName}`"
      @click="removeGuest(i)"
      class="absolute -top-1 -right-1 size-4! p-0! rounded-full! bg-tab-card! text-accent!"
    >
      <CrossIcon
        class="size-2.5"
        slot="iconBefore"
      />
    </Button>
```

with:

```astro
    <Button
      type="button"
      variant="ghost"
      icon
      :aria-label="`Remove ${g.displayName}`"
      @click="removeGuest(i)"
      class="absolute -top-1 -right-1 p-0.5 rounded-full bg-tab-card text-accent"
    >
      <CrossIcon
        class="size-4"
        slot="iconBefore"
      />
    </Button>
```

(No fixed `size-4` on the button anymore — its footprint now follows `CrossIcon`'s `size-4` plus `p-0.5` padding, and `Button.astro`'s own `items-center justify-center` centers it. No `!` anywhere.)

- [ ] **Step 8: Format and run the structural gates**

Run:
```bash
cd app && npm run format
bash ../scripts/check-astro-conventions.sh
bash ../scripts/check-style-tokens.sh
```
Expected: `npm run format` reports no changes needed (or auto-fixes whitespace only); both gate scripts print `OK: ...`. `check-style-tokens.sh` still reports the 5 other pre-existing `!` usages (GameCard, SetupShell, FiveOhOneSetupForm ×2, ScoreTrainingSetupForm, games/index) as `FAIL` — that's expected, Task 2 removes those. Confirm specifically that `AddGuestButton.astro` and `GuestSection.astro` no longer appear in the `check-style-tokens.sh` output.

- [ ] **Step 9: Manual verification**

Run: `cd app && astro dev --background`, then open `/games/501/setup` in the pre-installed browser and confirm: the dashed add-guest circle has a clearly visible thick accent-colored border; adding a guest replaces the circle with the guest avatar + remove badge and the add-guest circle does not reappear; the remove badge's cross icon is centered and appropriately sized (not a tiny icon in an oversized fixed box). Stop the server after: `astro dev stop`.

- [ ] **Step 10: Commit**

```bash
git add app/src/components/forms/Button.astro \
  app/src/components/layout/games/setup/AddGuestButton.astro \
  app/src/components/layout/games/setup/GuestSection.astro \
  app/src/lib/game/five-oh-one-setup.data.ts \
  app/tests/lib/game/five-oh-one-setup.data.test.ts
git commit -m "fix: harden guest-add button outline, icon sizing, and 1v1 cap"
```

---

## Task 2: Ban the Tailwind important modifier repo-wide

**Files:**
- Modify: `scripts/check-style-tokens.sh`
- Modify: `app/src/components/layout/games/GameCard.astro:19`
- Modify: `app/src/components/layout/games/setup/SetupShell.astro:57`
- Modify: `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro:48,74`
- Modify: `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro:44`
- Modify: `app/src/pages/games/index.astro:72`
- Modify: `app/CLAUDE.md` ("Style non-negotiables")
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md` (lines 206-215, 234)
- Modify: `decisions/frontend/style.md` (append new decision, supersedes D175)

**Interfaces:**
- Consumes: nothing new — this task only removes `!` suffixes from existing plain Tailwind classes; every removal relies on `cn()`'s `twMerge` already resolving same-category conflicts by class order (proven in the design spec, Section 2).
- Produces: `scripts/check-style-tokens.sh` exits non-zero on ANY `!`-suffixed or `!`-prefixed Tailwind class under `app/src/**/*.{astro,css}` — later tasks (and the follow-up 8-engine plan) must never reintroduce either form.

- [ ] **Step 1: Migrate the 5 remaining files off suffix-`!`**

`app/src/components/layout/games/GameCard.astro:19` — change:
```astro
<CardWrapper
  class="flex-row! justify-between items-center gap-4 glass"
  href={href}
>
```
to:
```astro
<CardWrapper
  class="flex-row justify-between items-center gap-4 glass"
  href={href}
>
```
(`CardWrapper.astro`'s base is `flex flex-col ...`; `classNameProp` is merged last through `cn()`, so `flex-row` already wins over `flex-col` without `!`.)

`app/src/components/layout/games/setup/SetupShell.astro:57` — change:
```astro
    <Button
      type="submit"
      class="rounded-full! w-full bg-accent! text-white! border-tab-border!"
      variant="primary"
      title="Start Game"
      :disabled="loading || loadingReconciliation"
    />
```
to:
```astro
    <Button
      type="submit"
      class="rounded-full w-full bg-accent text-white border-tab-border"
      variant="primary"
      title="Start Game"
      :disabled="loading || loadingReconciliation"
    />
```
(`Button.astro`'s `primary` variant sets `border-transparent bg-white text-black`; `classNameProp` merges last, so `border-tab-border`/`bg-accent`/`text-white` already win their respective same-category conflicts, and `rounded-full` wins over the base's `rounded-md`.)

`app/src/components/layout/games/setup/FiveOhOneSetupForm.astro` — two occurrences, lines 48 and 74, both:
```astro
      class="glass border-tab-border rounded-full! mt-4"
```
→
```astro
      class="glass border-tab-border rounded-full mt-4"
```

`app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro:44` — same change:
```astro
      class="glass border-tab-border rounded-full! mt-4"
```
→
```astro
      class="glass border-tab-border rounded-full mt-4"
```
(`Input.astro`'s base is `rounded-md border border-border ...`; `classNameProp` merges last, so `rounded-full`/`border-tab-border` already win without `!`.)

`app/src/pages/games/index.astro:72` — change:
```astro
          <div class="card-wrapper glass flex flex-row! items-center justify-between gap-3 rounded-2xl p-5 animate-pulse">
```
to:
```astro
          <div class="card-wrapper glass flex flex-row items-center justify-between gap-3 rounded-2xl p-5 animate-pulse">
```
(This is a single static string with no other flex-direction class in it — `flex-row` was never overriding anything here, `!` was inert.)

- [ ] **Step 2: Confirm zero `!`-suffixed classes remain**

Run: `grep -rnoE 'class=(["'"'"'\`])[^"'"'"'\`]*\1' app/src --include="*.astro" | grep -E '[a-zA-Z0-9%/\]-]!' || echo "none found"`
Expected: `none found`.

- [ ] **Step 3: Extend `check-style-tokens.sh` to ban suffix-important too**

Replace the whole `PREFIX_IMPORTANT` block in `scripts/check-style-tokens.sh` (currently lines 46-60) with:

```bash
IMPORTANT_MODIFIER=$(
  {
    # Prefix form: !utility (banned since D175)
    grep -rnE '(^|[^:])class="[^"]*![a-z]|(^|[^:])class='\''[^'\'']*![a-z]|(^|[^:])class=\{`[^`]*![a-z]' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE '["'\''`]![a-z][a-z0-9]*(-[a-z0-9./%-]+|-\[[^]]+\]|\[[^]]+\])' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE 'cn\([^)]*["'\''`]![a-z]+["'\''`]' \
      app/src --include="*.astro" || true
    # Suffix form: utility! (banned since D226 — supersedes D175's endorsement)
    grep -rnE '(^|[^:])class="[^"]*[a-zA-Z0-9_./%]!([[:space:]]|")' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE "(^|[^:])class='[^']*[a-zA-Z0-9_./%]!([[:space:]]|')" \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE '(^|[^:])class=\{`[^`]*[a-zA-Z0-9_./%]!([[:space:]]|`)' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE 'cn\([^)]*["'\''`][a-zA-Z0-9_./%-]+!["'\''`]' \
      app/src --include="*.astro" || true
  } | sort -u
)
if [ -n "$IMPORTANT_MODIFIER" ]; then
  echo "FAIL: Tailwind important modifier found (prefix !utility or suffix utility!) — compose overrides through cn()'s merge ordering, or extend the primitive's own variant/prop surface instead:" >&2
  echo "$IMPORTANT_MODIFIER" >&2
  FAIL=1
fi
```

Also update the final `echo "OK: ..."` line at the bottom of the script:
```bash
echo "OK: no font-medium, {...rest}, raw bg-bg*/text-fg*, important modifier (prefix or suffix), or leading-dash arbitrary (-prop-[…]) under app/src."
```

And update the script's own header comment (lines 1-19) — change:
```
# - no Tailwind v3 prefix-important (!utility) — use utility! (v4)
```
to:
```
# - no Tailwind important modifier at all — neither prefix (!utility) nor
#   suffix (utility!, formerly the sanctioned v4 form under D175 — see D226)
```

- [ ] **Step 4: Run the gate to verify it's clean**

Run: `bash scripts/check-style-tokens.sh`
Expected: `OK: no font-medium, {...rest}, raw bg-bg*/text-fg*, important modifier (prefix or suffix), or leading-dash arbitrary (-prop-[…]) under app/src.`

- [ ] **Step 5: Prove the new suffix check actually fires**

Temporarily add a throwaway line to confirm the gate is not a no-op:
```bash
echo '<div class="flex-row! p-2"></div>' >> /tmp/claude-0/-home-user-dart-analytics/8b1ddded-ad43-5662-9226-644804ae241b/scratchpad/suffix-fixture.astro
mkdir -p app/src/components/__suffix_fixture__ && cp /tmp/claude-0/-home-user-dart-analytics/8b1ddded-ad43-5662-9226-644804ae241b/scratchpad/suffix-fixture.astro app/src/components/__suffix_fixture__/Fixture.astro
bash scripts/check-style-tokens.sh; echo "exit: $?"
rm -rf app/src/components/__suffix_fixture__
```
Expected: the script prints `FAIL: Tailwind important modifier found ...` naming `Fixture.astro:1` and exits 1. Then confirm the cleanup removed the fixture: `git status --short app/src/components/` shows nothing.

- [ ] **Step 6: Update `app/CLAUDE.md`**

In the "Style non-negotiables" bullet list, change:
```
- Tailwind v4 utilities only — suffix important (`utility!`), never prefix (`!utility`); arbitrary negatives as `left-[-45%]`, never `-left-[45%]`
```
to:
```
- Tailwind v4 utilities only — no important modifier at all, neither prefix (`!utility`) nor suffix (`utility!`); compose overrides through `cn()`'s merge ordering, or extend the primitive's own variant/prop surface when its defaults conflict; arbitrary negatives as `left-[-45%]`, never `-left-[45%]`
```
And in the same section's closing sentence, change:
```
`font-medium`/`{...rest}`/raw palette utilities/Tailwind v4 `!utility` + `-prop-[…]` mechanically enforced by `scripts/check-style-tokens.sh` (2026-07-31)
```
to:
```
`font-medium`/`{...rest}`/raw palette utilities/Tailwind important modifier (either form) + `-prop-[…]` mechanically enforced by `scripts/check-style-tokens.sh` (2026-07-31; important-modifier ban widened to suffix form 2026-08-21)
```

- [ ] **Step 7: Update `docs/architecture/07-Frontend/07-Style-Guide.md`**

Replace the "Tailwind v4 class syntax" section (lines 206-215):
```markdown
# Tailwind v4 class syntax

This repo uses Tailwind CSS v4 utility forms. Agents must not emit v3-era variants.

| Do | Don't |
| -- | ----- |
| Suffix important: `max-w-none!`, `flex-row!`, `size-[130vmin]!` | Prefix important: `!max-w-none`, `!flex`, `!size-[130vmin]` |
| Negative inside arbitrary: `left-[-45%]`, `bottom-[-25%]` | Leading-dash arbitrary: `-left-[45%]`, `-bottom-[25%]` |

Scale negatives without arbitrary brackets stay fine (`-mt-4`, `-rotate-45`, `-translate-x-1/2`). Mechanically enforced by `scripts/check-style-tokens.sh` (D175).
```
with:
```markdown
# Tailwind v4 class syntax

This repo uses Tailwind CSS v4 utility forms. Agents must not emit v3-era variants, and must never reach for the important modifier at all.

| Do | Don't |
| -- | ----- |
| Compose overrides via `cn()`'s merge ordering (`classNameProp` merges last) | Important modifier, prefix or suffix: `!max-w-none`, `max-w-none!` |
| Extend a primitive's own variant/prop surface when its defaults genuinely conflict (e.g. `Button.astro`'s `dashed` variant) | Layering `!`-forced overrides on top of a primitive |
| Negative inside arbitrary: `left-[-45%]`, `bottom-[-25%]` | Leading-dash arbitrary: `-left-[45%]`, `-bottom-[25%]` |

Scale negatives without arbitrary brackets stay fine (`-mt-4`, `-rotate-45`, `-translate-x-1/2`). Mechanically enforced by `scripts/check-style-tokens.sh` (D226, supersedes D175's suffix-form endorsement).
```

And in the "Anti-patterns" table (around line 234), change the row:
```
| Prefix important `!utility` | Suffix important `utility!` (Tailwind v4) |
```
to:
```
| Important modifier, either form: `!utility` or `utility!` | Compose through `cn()`'s merge ordering, or extend the primitive's variant/prop surface |
```

- [ ] **Step 8: Append the new decision to `decisions/frontend/style.md`**

First re-derive the next id (do not trust the number below if other decisions have landed since this plan was written):
```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**/*.md decisions/*.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Append this block to the end of `decisions/frontend/style.md` (after D218, never editing the existing table or D218's block):

```markdown
### D226 — Ban the Tailwind important modifier entirely, both forms
Status: Accepted · Date: 2026-08-21
Decision: `scripts/check-style-tokens.sh` now bans the Tailwind important modifier in both forms — prefix (`!utility`, already banned by D175) and suffix (`utility!`, D175's own sanctioned v4 form). Overrides are composed as plain classes through `cn()`'s merge ordering (`classNameProp` is always merged last in every component's `cn()` call, so a plain conflicting utility already wins); when a primitive's own defaults are too far from what a screen needs, the primitive's variant/prop surface is extended instead (e.g. `Button.astro`'s new `dashed` variant), rather than layering an override on top of it.
Reason: Auditing every `!`-suffixed class in the repo (`GameCard.astro`, `SetupShell.astro`, `FiveOhOneSetupForm.astro`, `ScoreTrainingSetupForm.astro`, `pages/games/index.astro`, `AddGuestButton.astro`, `GuestSection.astro`) found every single usage was a same-category Tailwind utility conflict (`rounded-md` vs `rounded-full`, `bg-white` vs `bg-accent`, `flex-col` vs `flex-row`, …) that `cn()`'s `twMerge` already resolves by class order — confirmed by reading `global.css`'s `.btn`/`.btn-*` rules, which set only transitions/shadows/hover backgrounds, never padding/radius/border-color. The `!` modifier was never structurally necessary anywhere it was used.
Consequences: All 7 files migrated to plain classes in the same change. `scripts/check-style-tokens.sh`'s `IMPORTANT_MODIFIER` check now flags both forms; `07-Frontend/07-Style-Guide.md` and `app/CLAUDE.md`'s Style non-negotiables no longer present suffix-`!` as the correct v4 form.
Supersedes: D175
```

- [ ] **Step 9: Format, run gates, run full validation**

Run:
```bash
cd app && npm run format && npm run format:check
bash ../scripts/check-style-tokens.sh
bash ../scripts/check-astro-conventions.sh
npm run validate:app
```
Expected: all commands exit 0; `validate:app`'s type-check step reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 10: Commit**

```bash
git add scripts/check-style-tokens.sh \
  app/src/components/layout/games/GameCard.astro \
  app/src/components/layout/games/setup/SetupShell.astro \
  app/src/components/layout/games/setup/FiveOhOneSetupForm.astro \
  app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro \
  app/src/pages/games/index.astro \
  app/CLAUDE.md \
  docs/architecture/07-Frontend/07-Style-Guide.md \
  decisions/frontend/style.md
git commit -m "style: ban Tailwind important modifier in both forms (supersedes D175)"
```

---

## Task 3: Split scoreboard shell, seat-parameterized 501 data, and wiring

**Files:**
- Create: `app/src/components/layout/games/SplitScoreboardHalf.astro`
- Create: `app/src/components/layout/games/SplitScoreboard.astro`
- Modify: `app/src/lib/game/five-oh-one-play.data.ts` (add seat-parameterized getters)
- Modify: `app/src/lib/game/types.ts` (`FiveOhOnePlayContext` — declare the new getters)
- Modify: `app/src/components/layout/games/interfaces/FiveOhOne.astro` (branch on seat count)
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: `SinglePlayerDisplay.astro` (`isTarget`/`score`/`target`/`class` props, `progress` slot — unchanged); `Badge.astro` (`variant`, default slot); `cn()`; `FiveOhOneState` (`seats: readonly FiveOhOneSeatState[]`, `sides: readonly FiveOhOneSideState[]`, `activeParticipantRef: string`) from `@modules/types`; `$store.game.seats: readonly SeatFact[]` (`participantRef`, `displayName`, `sideKey`, `participantTypeKey`).
- Produces:
  - `SplitScoreboardHalf.astro` props: `nameExpr: string`, `activeExpr: string`, `scoreExpr: string`, `isTarget?: boolean` (default `true`), `legsExpr?: string`, `legsToWinExpr?: string`, `checkoutExpr?: string`, `class?: string`; default slot renders inside the body's `progress` region.
  - `SplitScoreboard.astro` props: `seatA: { nameExpr, activeExpr, scoreExpr, legsExpr?, checkoutExpr? }`, `seatB: <same shape>`, `isTarget?: boolean`, `legsToWinExpr?: string`, `class?: string`; named slots `progressA`/`progressB`.
  - `FiveOhOnePlayContext` gains: `remainingScoreFor(seatRef: string): number`, `checkoutHintFor(seatRef: string): string`, `averageFor(seatRef: string): string`, `previousScoreFor(seatRef: string): string`, `dartsThrownThisLegFor(seatRef: string): number`, `legsWonFor(seatRef: string): number`. The existing no-arg `remainingScore()`/`checkoutHint()`/`average()`/`previousScore()`/`dartsThrownThisLeg()` keep their exact current signatures and behavior (delegating internally) — the follow-up 8-engine plan can use these six `*For` methods as the template for each other engine's own `*-play.data.ts`.

- [ ] **Step 1: Write the failing tests for the seat-parameterized getters**

Add to `app/tests/lib/game/five-oh-one-play.data.test.ts`, right after the existing `describe("checkoutHint", ...)` block (after line 476):

```ts
describe("seat-parameterized getters — two-seat isolation", () => {
  const SEAT_B = "participant-2";

  function twoSeatConfig() {
    return {
      ...quickPlayConfig(),
      seats: [
        ...SEATS,
        {
          participantRef: SEAT_B,
          displayName: "Sam",
          sideKey: "B",
          participantTypeKey: "GUEST" as const,
        },
      ],
    };
  }

  it("remainingScoreFor reads only the named seat's own remaining score", async () => {
    const seatATurns = turnsReaching(40); // participant-1 down to 40
    const seatBTurn = turnFact("tB1", "leg-1", 2, 60, SEAT_B); // participant-2 scored 60
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: [...seatATurns, seatBTurn],
    });
    await play.init.call(play);

    expect(play.remainingScoreFor.call(play, "participant-1")).toBe(40);
    expect(play.remainingScoreFor.call(play, SEAT_B)).toBe(501 - 60);
  });

  it("remainingScore() delegates to the active seat", async () => {
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    expect(play.remainingScore.call(play)).toBe(
      play.remainingScoreFor.call(play, play.state.call(play)!.activeParticipantRef),
    );
  });

  it("averageFor and previousScoreFor do not leak one seat's visits into the other's", async () => {
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: [
        turnFact("t1", "leg-1", 1, 100, "participant-1"),
        turnFact("t2", "leg-1", 2, 45, SEAT_B),
      ],
    });
    await play.init.call(play);

    expect(play.previousScoreFor.call(play, "participant-1")).toBe("100");
    expect(play.previousScoreFor.call(play, SEAT_B)).toBe("45");
    expect(play.averageFor.call(play, "participant-1")).not.toBe(
      play.averageFor.call(play, SEAT_B),
    );
  });

  it("dartsThrownThisLegFor counts only the named seat's own visits in the open leg", async () => {
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: [
        turnFact("t1", "leg-1", 1, 60, "participant-1"),
        turnFact("t2", "leg-1", 2, 45, SEAT_B),
        turnFact("t3", "leg-1", 3, 60, "participant-1"),
      ],
    });
    await play.init.call(play);

    expect(play.dartsThrownThisLegFor.call(play, "participant-1")).toBe(6);
    expect(play.dartsThrownThisLegFor.call(play, SEAT_B)).toBe(3);
  });

  it("checkoutHintFor reads the named seat's own remaining score", async () => {
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: turnsReaching(40), // only participant-1 has thrown
    });
    await play.init.call(play);

    expect(play.checkoutHintFor.call(play, "participant-1")).toBe("D20");
    expect(play.checkoutHintFor.call(play, SEAT_B)).toBe(""); // untouched, still 501 — not checkoutable
  });

  it("legsWonFor reads each seat's own side (0 legs won at the start of a fresh match)", async () => {
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    expect(play.legsWonFor.call(play, "participant-1")).toBe(0);
    expect(play.legsWonFor.call(play, SEAT_B)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t "seat-parameterized getters"`
Expected: FAIL — every test errors with something like `play.remainingScoreFor is not a function`, since none of the six `*For` methods exist yet.

- [ ] **Step 3: Add the seat-parameterized getters to `five-oh-one-play.data.ts`**

Replace the five existing getters (`remainingScore`, `checkoutHint`, `dartsThrownThisLeg`, `average`, `previousScore`, and the block right after `turnsInCurrentLeg`) — currently lines 186-220 — with:

```ts
    remainingScoreFor(this: FiveOhOnePlayContext, seatRef: string): number {
      const state = this.state();
      if (!state) return 0;
      const seat = state.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.remainingScore ?? 0;
    },

    remainingScore(this: FiveOhOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.remainingScoreFor(state.activeParticipantRef);
    },

    checkoutHintFor(this: FiveOhOnePlayContext, seatRef: string): string {
      const path = checkoutPathFor(this.remainingScoreFor(seatRef));
      return path ? path.join(" ") : "";
    },

    checkoutHint(this: FiveOhOnePlayContext): string {
      const path = checkoutPathFor(this.remainingScore());
      return path ? path.join(" ") : "";
    },

    dartsThrownThisLegFor(this: FiveOhOnePlayContext, seatRef: string): number {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      const seatTurns = this.turnsInCurrentLeg().filter(
        (turn) => turn.participantRef === seatRef,
      );
      return dartsThrownCount(seatTurns, maxDartsPerTurn);
    },

    dartsThrownThisLeg(this: FiveOhOnePlayContext): number {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return dartsThrownCount(this.turnsInCurrentLeg(), maxDartsPerTurn);
    },

    /**
     * Match-wide, not leg-scoped: unlike darts thrown, the average and the
     * previous visit's score are a running read on the player across the
     * whole match, so they must survive a leg boundary rather than reset to
     * zero the instant a new leg's stage opens.
     */
    averageFor(this: FiveOhOnePlayContext, seatRef: string): string {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      const seatTurns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === seatRef,
      );
      return threeDartAverageDisplay(seatTurns, maxDartsPerTurn);
    },

    average(this: FiveOhOnePlayContext): string {
      const state = this.state();
      if (!state) return "0.0";
      return this.averageFor(state.activeParticipantRef);
    },

    previousScoreFor(this: FiveOhOnePlayContext, seatRef: string): string {
      const seatTurns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === seatRef,
      );
      return previousScoreDisplay(seatTurns);
    },

    previousScore(this: FiveOhOnePlayContext): string {
      const state = this.state();
      if (!state) return "—";
      return this.previousScoreFor(state.activeParticipantRef);
    },

    legsWonFor(this: FiveOhOnePlayContext, seatRef: string): number {
      const state = this.state();
      if (!state) return 0;
      const seat = state.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      const side = state.sides.find(
        (candidate) => candidate.sideKey === seat?.sideKey,
      );
      return side?.legsWon ?? 0;
    },
```

Note: `average(this: FiveOhOnePlayContext)` previously used `this.$store.game.turns` directly (whole match, no seat filter — an existing bug for a 2-seat match, silently mixing both players' visits into one average). This change also fixes that: it now filters to the active seat's own turns via `averageFor`. Same for `previousScore()`. This is a correctness fix required to make `averageFor`/`previousScoreFor` meaningful per seat — it cannot be deferred, since the whole point of the split scoreboard is that each half shows its own seat's stats, and the single-seat display path (`state().seats.length === 1`) is unaffected (its one seat's turns are the only turns in the log, so filtering by that seat's ref is a no-op there).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: PASS, entire file green (all pre-existing tests still pass — single-seat sessions have exactly one `participantRef` in their turns, so the new filters are no-ops there).

- [ ] **Step 5: Declare the new methods on `FiveOhOnePlayContext`**

In `app/src/lib/game/types.ts`, replace:

```ts
  remainingScore(this: FiveOhOnePlayContext): number;
  checkoutHint(this: FiveOhOnePlayContext): string;
  dartsThrownThisLeg(this: FiveOhOnePlayContext): number;
  average(this: FiveOhOnePlayContext): string;
  previousScore(this: FiveOhOnePlayContext): string;
```

with:

```ts
  remainingScoreFor(this: FiveOhOnePlayContext, seatRef: string): number;
  remainingScore(this: FiveOhOnePlayContext): number;
  checkoutHintFor(this: FiveOhOnePlayContext, seatRef: string): string;
  checkoutHint(this: FiveOhOnePlayContext): string;
  dartsThrownThisLegFor(this: FiveOhOnePlayContext, seatRef: string): number;
  dartsThrownThisLeg(this: FiveOhOnePlayContext): number;
  averageFor(this: FiveOhOnePlayContext, seatRef: string): string;
  average(this: FiveOhOnePlayContext): string;
  previousScoreFor(this: FiveOhOnePlayContext, seatRef: string): string;
  previousScore(this: FiveOhOnePlayContext): string;
  legsWonFor(this: FiveOhOnePlayContext, seatRef: string): number;
```

- [ ] **Step 6: Run the type check**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 7: Create `SplitScoreboardHalf.astro`**

```astro
---
/**
 * One seat's column inside `SplitScoreboard.astro`: avatar + name + active
 * dot, an optional leg-wins pill, the seat's big score/target number (reuses
 * `SinglePlayerDisplay.astro`), an optional checkout-hint chip row, and an
 * optional leg/round progress dot pager. The default slot renders inside the
 * body's `progress` region, alongside the checkout chips — this is where a
 * caller puts its own per-game `StatRow`s, parameterized to this seat.
 * @param {string} nameExpr Alpine expr resolving to this seat's display name
 * @param {string} activeExpr Alpine expr, true while this seat is throwing
 * @param {string} scoreExpr Alpine expr for the big number
 * @param {boolean} [isTarget] Passed straight through to `SinglePlayerDisplay`
 * @param {string} [legsExpr] Alpine expr for this seat's side's legs won; omit to hide the pill
 * @param {string} [legsToWinExpr] Alpine expr for the leg target; omit to hide the dot pager
 * @param {string} [checkoutExpr] Alpine expr for the checkout-hint string ("T20 9 D16"); omit to hide the chip row
 * @param {string} [class] Extra classes on the outer column
 */
interface Props {
  nameExpr: string;
  activeExpr: string;
  scoreExpr: string;
  isTarget?: boolean;
  legsExpr?: string;
  legsToWinExpr?: string;
  checkoutExpr?: string;
  class?: string;
}

// Props
const {
  nameExpr,
  activeExpr,
  scoreExpr,
  isTarget = true,
  legsExpr,
  legsToWinExpr,
  checkoutExpr,
  class: classNameProp = "",
}: Props = Astro.props;

// Components
import SinglePlayerDisplay from "./SinglePlayerDisplay.astro";
import Badge from "@components/ui/Badge.astro";

// Icons
import UserIcon from "@icons/user.svg";

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn("flex flex-col gap-1 items-center min-h-0 flex-1", classNameProp);
---

<div class={className}>
  <div class="flex items-center gap-2">
    <div class="relative">
      <div class="p-2 border-x border-t w-fit border-sky-500/70 rounded-full bg-tab-active">
        <UserIcon class="size-5 drop-shadow-lg drop-shadow-sky-700/40 text-sky-500" />
      </div>
      <span
        class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-accent border border-tab-card"
        x-show={activeExpr}
        x-cloak
        aria-hidden="true"
      >
      </span>
    </div>
    <span
      class="text-sm text-accent font-semibold"
      x-text={nameExpr}
    ></span>
    {
      legsExpr && (
        <Badge variant="accent" class="text-xs" x-text={legsExpr} />
      )
    }
  </div>

  <SinglePlayerDisplay
    isTarget={isTarget}
    target={scoreExpr}
    score={scoreExpr}
    class="w-full flex-1 min-h-0"
  >
    <div slot="progress" class="mt-2 flex w-full flex-col items-center gap-2 px-4">
      {
        checkoutExpr && (
          <div
            class="flex gap-1"
            x-show={checkoutExpr}
            x-cloak
          >
            <template x-for={`part in (${checkoutExpr}).split(' ').filter(Boolean)`} :key="part">
              <Badge variant="accent" class="text-xs font-mono" x-text="part"></Badge>
            </template>
          </div>
        )
      }
      <slot />
      {
        legsToWinExpr && (
          <div
            class="flex gap-1 mt-1"
            x-show={legsToWinExpr}
            x-cloak
          >
            <template x-for={`n in Array.from({ length: ${legsToWinExpr} ?? 0 }, (_, i) => i)`} :key="n">
              <span
                class="size-1.5 rounded-full bg-muted"
                :class={`{ 'bg-accent': n < (${legsExpr ?? "0"}) }`}
              ></span>
            </template>
          </div>
        )
      }
    </div>
  </SinglePlayerDisplay>
</div>
```

- [ ] **Step 8: Create `SplitScoreboard.astro`**

```astro
---
/**
 * Two-seat scoreboard shell: renders when a session has exactly 2 seats,
 * wrapping two `SplitScoreboardHalf.astro` columns side by side with a
 * vertical divider. Each half's dynamic content is driven entirely by the
 * Alpine expression strings the caller passes in — this component is static
 * markup, not itself seat-aware.
 * @param {object} seatA `{ nameExpr, activeExpr, scoreExpr, legsExpr?, checkoutExpr? }`
 * @param {object} seatB Same shape as `seatA`
 * @param {boolean} [isTarget] Passed through to both halves
 * @param {string} [legsToWinExpr] Passed through to both halves, for the dot pager
 * @param {string} [class] Extra classes on the outer grid
 */
interface SeatDisplay {
  nameExpr: string;
  activeExpr: string;
  scoreExpr: string;
  legsExpr?: string;
  checkoutExpr?: string;
}

interface Props {
  seatA: SeatDisplay;
  seatB: SeatDisplay;
  isTarget?: boolean;
  legsToWinExpr?: string;
  class?: string;
}

// Props
const {
  seatA,
  seatB,
  isTarget = true,
  legsToWinExpr,
  class: classNameProp = "",
}: Props = Astro.props;

// Components
import SplitScoreboardHalf from "./SplitScoreboardHalf.astro";

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn(
  "grid grid-cols-2 divide-x divide-border flex-1 min-h-0 glass rounded-lg",
  classNameProp,
);
---

<div class={className}>
  <SplitScoreboardHalf
    nameExpr={seatA.nameExpr}
    activeExpr={seatA.activeExpr}
    scoreExpr={seatA.scoreExpr}
    isTarget={isTarget}
    legsExpr={seatA.legsExpr}
    legsToWinExpr={legsToWinExpr}
    checkoutExpr={seatA.checkoutExpr}
    class="p-2"
  >
    <slot name="progressA" />
  </SplitScoreboardHalf>
  <SplitScoreboardHalf
    nameExpr={seatB.nameExpr}
    activeExpr={seatB.activeExpr}
    scoreExpr={seatB.scoreExpr}
    isTarget={isTarget}
    legsExpr={seatB.legsExpr}
    legsToWinExpr={legsToWinExpr}
    checkoutExpr={seatB.checkoutExpr}
    class="p-2"
  >
    <slot name="progressB" />
  </SplitScoreboardHalf>
</div>
```

- [ ] **Step 9: Wire `FiveOhOne.astro` to branch on seat count**

Replace the whole file:

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
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <template x-if="(state()?.seats.length ?? 1) < 2">
    <SinglePlayerDisplay
      isTarget={true}
      target="remainingScore()"
      class="max-h-2/5 h-full"
    >
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <p
          class="text-sm font-mono font-semibold text-accent"
          x-show="checkoutHint()"
          x-text="checkoutHint()"
          x-cloak
        >
        </p>
        <dl class="w-full space-y-1">
          <StatRow
            label="3 dart avg"
            value="average()"
          />
          <StatRow
            label="Previous score"
            value="previousScore()"
          />
          <StatRow
            label="Darts"
            value="dartsThrownThisLeg()"
          />
        </dl>
      </div>
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
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "remainingScoreFor(state()?.seats[1]?.participantRef)",
        legsExpr: "legsWonFor(state()?.seats[1]?.participantRef)",
        checkoutExpr: "checkoutHintFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={true}
      legsToWinExpr="$store.game.configSnapshot?.legsToWin"
      class="max-h-2/5 h-full"
    >
      <dl slot="progressA" class="w-full space-y-1">
        <StatRow label="3 dart avg" value="averageFor(state()?.seats[0]?.participantRef)" />
        <StatRow label="Previous score" value="previousScoreFor(state()?.seats[0]?.participantRef)" />
        <StatRow label="Darts" value="dartsThrownThisLegFor(state()?.seats[0]?.participantRef)" />
      </dl>
      <dl slot="progressB" class="w-full space-y-1">
        <StatRow label="3 dart avg" value="averageFor(state()?.seats[1]?.participantRef)" />
        <StatRow label="Previous score" value="previousScoreFor(state()?.seats[1]?.participantRef)" />
        <StatRow label="Darts" value="dartsThrownThisLegFor(state()?.seats[1]?.participantRef)" />
      </dl>
    </SplitScoreboard>
  </template>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

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

(A 1-seat session's markup is byte-for-byte what it was before this task, just now inside an `x-if` branch — no visual change for the single-seat path, matching the design spec's "Wiring" section.)

- [ ] **Step 10: Run the structural gates**

Run:
```bash
cd app && npm run format
bash ../scripts/check-astro-conventions.sh
bash ../scripts/check-style-tokens.sh
bash ../scripts/check-file-locations.sh
bash ../scripts/check-game-wiring.sh
```
Expected: all print `OK: ...`.

- [ ] **Step 11: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type-check step reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 12: Manual verification**

Run: `cd app && astro dev --background`. In the pre-installed browser:
1. Start a solo 501 game (no guest added) — confirm the play screen looks exactly as it did before this task (single centered score/target display, no split).
2. Go back, start a 501 game with one guest added — confirm the play screen now shows two side-by-side halves, each with its own avatar/name, an active-turn dot on whichever seat is due to throw, the big remaining-score number, and its own 3-dart-avg/previous-score/darts stat rows.
3. Play a visit down to a checkout-reachable remainder (e.g. reduce a seat to 40) and confirm that seat's half shows separate chips (e.g. "D20"), not one line of text.
4. Play a full leg to completion and confirm the leg-wins pill increments on the winning side's half, and the dot pager (if `legsToWin > 1`) fills one dot.

Stop the server after: `astro dev stop`.

- [ ] **Step 13: Commit**

```bash
git add app/src/components/layout/games/SplitScoreboardHalf.astro \
  app/src/components/layout/games/SplitScoreboard.astro \
  app/src/lib/game/five-oh-one-play.data.ts \
  app/src/lib/game/types.ts \
  app/src/components/layout/games/interfaces/FiveOhOne.astro \
  app/tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "feat: split scoreboard shell wired into 501's two-seat play"
```

---

## Task 4: Context maintenance

**Files:** whatever `context-maintenance` identifies as stale (context map, `FINDINGS.md`, `DECISIONS.md` Deferred-list entries, knowledge-graph note).

- [ ] **Step 1: Run the context-maintenance skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`'s mandatory-every-task rule. It will check: whether `docs/architecture/00-Context-Map.md`'s Context Packs table needs `SplitScoreboard.astro`/`SplitScoreboardHalf.astro` added anywhere a frontend context pack lists `SinglePlayerDisplay.astro`; whether the D226 decision block (Task 2, Step 8) is correctly appended and routed; whether the graph-refresh note applies (CI-owned, per root `CLAUDE.md` — no local action expected); and whether `FINDINGS.md` needs anything logged (e.g. the pre-existing `average()`/`previousScore()` seat-mixing bug fixed as a required part of Task 3, Step 3 — log it as already-fixed context if the skill's procedure calls for that, do not treat it as a new open finding).

- [ ] **Step 2: Apply whatever targeted edits the skill identifies**

Minimal diffs only — no doc regeneration.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: context maintenance for guest-play UI fixes and split scoreboard"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (setup fixes) → Task 1. Section 2 (important-modifier ban) → Task 2. Section 3 (split scoreboard) → Task 3, scoped to 501 per the spec's own "Rollout" staging (shared shell proven on the one engine that can reach 2 seats today; the other 8 engines are explicitly deferred to a follow-up plan, matching the spec's "then one task per remaining engine" note). Testing section → covered inline in each task's steps. Context Maintenance → Task 4, per the root `CLAUDE.md` hard invariant.
- **Placeholder scan:** no TBD/TODO; every step shows complete, real code.
- **Type consistency:** `remainingScoreFor`/`checkoutHintFor`/`averageFor`/`previousScoreFor`/`dartsThrownThisLegFor`/`legsWonFor` are named identically in `five-oh-one-play.data.ts` (Task 3 Step 3), `types.ts` (Task 3 Step 5), the new tests (Task 3 Step 1), and the `FiveOhOne.astro` wiring (Task 3 Step 9) — verified by re-reading all four call sites side by side.
- **A pre-existing bug fix inside Task 3** (average()/previousScore() previously mixed both seats' turns in a 2-seat session) is disclosed explicitly in Task 3 Step 3's note rather than silently folded in, since root `CLAUDE.md`'s finding rule requires incidental discoveries to be logged rather than fixed in-pass — this one is not incidental, it is required by the task's own deliverable (per-seat stats cannot work without it), so it proceeds as normal work per that rule's own carve-out ("adjacent edits that work genuinely requires").
