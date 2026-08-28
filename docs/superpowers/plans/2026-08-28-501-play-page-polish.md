# 501 Play-Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four small 501 play-page UI issues from issue #167 Part A: remove the redundant leg-dot pager in 1v1, make the header title reflect the configured leg count live, drop "score" from the "Previous score" stat label, and put the checkout-confirm dialog's buttons side by side (cancel left, confirm right) like every other confirm dialog in the app.

**Architecture:** Four independent, template-and-one-method-level edits. No engine, schema, or type-shape change beyond one new string-returning method (`matchTitle()`) and one new optional Alpine-expression prop on the shared `GameLayout`. No new component.

**Tech Stack:** Astro `.astro` components, Alpine.js (`x-text`, `x-show`), TypeScript (`.data.ts`/`types.ts`), Vitest.

## Global Constraints

- Semantic tokens/primitives only; no raw palette utilities, no `font-medium` (`07-Style-Guide.md`).
- Alpine v3 shorthand only (`:class`, `@click`) — never `x-bind:`/`x-on:` except the Astro `{}` linter escape, which is not needed anywhere in this plan.
- `.astro` markup/branching logic is D101-exempt from unit tests — no Astro component test runner exists in this project. Only `matchTitle()` (a plain TypeScript method) gets a test.
- No inline `//`/`/* */` comments inside `app/src/**/*.ts` function bodies (`app/CLAUDE.md`) — JSDoc above the declaration only.
- Every source-file change under `app/src/` needs a covering test touch, or `scripts/check-test-coverage.sh` fails the commit (D224) — this plan's only `.ts` change (`matchTitle()`) gets one in Task 3.
- `npm run format` (and a clean `npm run format:check`) before any commit that touches `app/` markup/TS (`app/CLAUDE.md`).
- Never commit `.env` or secrets; never edit applied migrations (not touched by this plan anyway).
- All work happens on a new branch checked out directly in the main working copy — no git worktrees (root `CLAUDE.md`).

---

## Setup

- [ ] **Step 0: Create the task branch**

```bash
git checkout -b claude/issue-167-play-page-polish
```

---

### Task 1: Remove the 1v1 leg-dot pager

**Files:**
- Modify: `app/src/components/layout/games/interfaces/FiveOhOne.astro:75`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this only stops passing an existing optional prop.

`SplitScoreboardHalf.astro`'s dot pager renders only when `legsToWinExpr` is
passed in; `FiveOhOne.astro` is the only caller in the codebase that passes
it. Deleting that one line hides the pager with zero change to the shared
`SplitScoreboard`/`SplitScoreboardHalf` components (which keep the prop —
it's a documented "omit to hide" optional feature per
`08-Component-Inventory.md`, not dead code to delete).

- [ ] **Step 1: Delete the `legsToWinExpr` line**

In `app/src/components/layout/games/interfaces/FiveOhOne.astro`, inside the
`<SplitScoreboard ...>` opening tag (the `x-if="(state()?.seats.length ?? 1)
>= 2"` block), delete this line:

```astro
      legsToWinExpr="$store.game.configSnapshot?.legsToWin"
```

The tag's remaining props (`seatA`, `seatB`, `isTarget`, `class`) are
unchanged.

- [ ] **Step 2: Confirm no other caller passes `legsToWinExpr`**

```bash
grep -rn "legsToWinExpr" app/src
```

Expected: only `SplitScoreboard.astro` and `SplitScoreboardHalf.astro`
themselves (declaring/forwarding the prop) — no `.astro` interface file
passes it anymore.

- [ ] **Step 3: Run the Astro conventions check**

```bash
bash scripts/check-astro-conventions.sh
```

Expected: passes (exit 0).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/games/interfaces/FiveOhOne.astro
git commit -m "Remove 1v1 leg-dot pager from 501's split scoreboard"
```

---

### Task 2: "Previous score" → "Previous"

**Files:**
- Modify: `app/src/components/layout/games/interfaces/FiveOhOne.astro:44`, `:87`, `:104`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — label text only, bound `value` expressions
  (`previousScore()` / `previousScoreFor(...)`) are unchanged.

Three `StatRow` occurrences in this file currently read
`label="Previous score"`: one in the solo (`< 2` seats) block, one each in
the 1v1 `seatA`/`seatB` slots.

- [ ] **Step 1: Update all three labels**

Change each of the three:

```astro
            label="Previous score"
```

to:

```astro
            label="Previous"
```

(Indentation differs slightly between the solo block, 4 spaces before
`label`, and the two 1v1 blocks — match whatever indentation is already on
that line; only the string content changes.)

- [ ] **Step 2: Confirm the count**

```bash
grep -n 'label="Previous' app/src/components/layout/games/interfaces/FiveOhOne.astro
```

Expected: 3 matches, each reading `label="Previous"`.

- [ ] **Step 3: Run the Astro conventions check**

```bash
bash scripts/check-astro-conventions.sh
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/games/interfaces/FiveOhOne.astro
git commit -m 'Rename 501 "Previous score" stat label to "Previous"'
```

---

### Task 3: Dynamic match title — `matchTitle()` + `GameLayout` `gameTitleExpr` prop

**Files:**
- Modify: `app/src/lib/game/types.ts` (add one method signature to `FiveOhOnePlayContext`)
- Modify: `app/src/lib/game/five-oh-one-play.data.ts` (add `matchTitle()`)
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts` (new test cases)
- Modify: `app/src/layouts/GameLayout.astro` (new `gameTitleExpr` prop)
- Modify: `app/src/pages/games/501/play/index.astro` (wire `gameTitleExpr="matchTitle()"`)

**Interfaces:**
- Consumes: `this.$store.game.configSnapshot?.legsToWin` (already on
  `FiveOhOnePlayContext.$store.game.configSnapshot`, typed
  `Seated<FiveOhOneSnapshot> | null` — `FiveOhOneSnapshot.legsToWin:
  number`).
- Produces: `matchTitle(this: FiveOhOnePlayContext): string` — returns
  `"501"` before a session's config has loaded, else `` `First to ${N}
  legs` `` where `N` is the configured leg count. `GameLayout.astro` gains
  `gameTitleExpr?: string` — an Alpine expression string rendered via
  `x-text`, taking precedence over the existing static `gameTitle` prop
  when both are given (no caller passes both today).

- [ ] **Step 1: Write the failing test**

Open `app/tests/lib/game/five-oh-one-play.data.test.ts`. Find the
`makePlay` helper (already defined near the top of the file, wraps
`fiveOhOnePlay()` with a stubbed `$store`) and the `bestOf5Config()` helper
(`legsToWin: 3`). Add this test case in a `describe("matchTitle")` block —
place it near the other simple-getter tests (e.g. alongside any existing
`describe` block for `average`/`previousScore`; if none exists, add the new
`describe` block right after the imports' helper functions, before the
first existing `describe`):

```typescript
describe("matchTitle", () => {
  it("falls back to 501 before a session's config has loaded", () => {
    const play = makePlay({ configSnapshot: null });
    expect(play.matchTitle()).toBe("501");
  });

  it("reads the configured leg count once loaded", () => {
    const play = makePlay({ configSnapshot: bestOf5Config() });
    expect(play.matchTitle()).toBe("First to 3 legs");
  });

  it("updates when a different leg count is configured", () => {
    const play = makePlay({
      configSnapshot: { ...bestOf5Config(), legsToWin: 5 },
    });
    expect(play.matchTitle()).toBe("First to 5 legs");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t matchTitle
```

Expected: FAIL — `play.matchTitle is not a function` (the method doesn't
exist yet, and `FiveOhOnePlayContext` doesn't declare it either, so this
will also fail to typecheck until Step 3).

- [ ] **Step 3: Declare the method on `FiveOhOnePlayContext`**

In `app/src/lib/game/types.ts`, inside the `FiveOhOnePlayContext` type
(search for `export type FiveOhOnePlayContext = {`), add this line right
after the existing `average(this: FiveOhOnePlayContext): string;` line:

```typescript
  average(this: FiveOhOnePlayContext): string;
  matchTitle(this: FiveOhOnePlayContext): string;
```

(only the second line is new — the first is shown for anchoring).

- [ ] **Step 4: Implement `matchTitle()`**

In `app/src/lib/game/five-oh-one-play.data.ts`, inside the object literal
returned by `fiveOhOnePlay()`, add this method right after the existing
`state(this: FiveOhOnePlayContext): FiveOhOneState | null { ... }` method
(the one that reads `this.$store.game.configSnapshot` and calls
`foldFiveOhOneState`):

```typescript
    /**
     * The play-page header's title. Falls back to the plain "501" before a
     * session's config has loaded; once loaded, names the match format the
     * session was actually configured with. A future task adding sets
     * extends this one function rather than the header template.
     */
    matchTitle(this: FiveOhOnePlayContext): string {
      const legsToWin = this.$store.game.configSnapshot?.legsToWin;
      return legsToWin ? `First to ${legsToWin} legs` : "501";
    },
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t matchTitle
```

Expected: PASS (3 tests).

- [ ] **Step 6: Run the full file's test suite**

```bash
cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts
```

Expected: all tests pass (no regression from the new method/type edit).

- [ ] **Step 7: Add `gameTitleExpr` to `GameLayout.astro`**

Read `app/src/layouts/GameLayout.astro` first. Its current `Props`
interface and header block are:

```astro
interface Props {
  title?: string;
  gameTitle?: string;
}

const { title, gameTitle }: Props = Astro.props;
```

and:

```astro
      <div class="w-6/8">
        {
          gameTitle ? (
            <h1 class="pointer-events-none uppercase font-mono  inset-0 flex items-center justify-center text-lg font-semibold text-foreground">
              {gameTitle}
            </h1>
          ) : null
        }
      </div>
```

Change the `Props` interface and destructure to:

```astro
interface Props {
  title?: string;
  gameTitle?: string;
  /** Alpine expression string, evaluated live via x-text; takes
   * precedence over the static `gameTitle` when both are given. */
  gameTitleExpr?: string;
}

const { title, gameTitle, gameTitleExpr }: Props = Astro.props;
```

Change the header block to a three-way branch (dynamic, static, none):

```astro
      <div class="w-6/8">
        {
          gameTitleExpr ? (
            <h1
              class="pointer-events-none uppercase font-mono  inset-0 flex items-center justify-center text-lg font-semibold text-foreground"
              x-text={gameTitleExpr}
            />
          ) : gameTitle ? (
            <h1 class="pointer-events-none uppercase font-mono  inset-0 flex items-center justify-center text-lg font-semibold text-foreground">
              {gameTitle}
            </h1>
          ) : null
        }
      </div>
```

(The class string is copied verbatim, double-space typo and all — do not
"fix" it as part of this task; that's an unrelated change outside this
plan's scope.)

- [ ] **Step 8: Wire the 501 play page to the dynamic title**

In `app/src/pages/games/501/play/index.astro`, the `<GameLayout>` call is:

```astro
<GameLayout
  title="501 — Play"
  gameTitle="501"
>
```

Change `gameTitle="501"` to `gameTitleExpr="matchTitle()"`:

```astro
<GameLayout
  title="501 — Play"
  gameTitleExpr="matchTitle()"
>
```

- [ ] **Step 9: Confirm no other `GameLayout` caller regressed**

```bash
grep -n "gameTitle=" app/src/pages/games/*/play/index.astro
```

Expected: every game except 501 still passes a plain `gameTitle="..."`
string; only 501's play page now uses `gameTitleExpr`.

- [ ] **Step 10: Run the Astro conventions check and typecheck**

```bash
bash scripts/check-astro-conventions.sh
cd app && npx astro check
```

Expected: both pass — 0 errors, 0 warnings, 0 hints from `astro check`.

- [ ] **Step 11: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/five-oh-one-play.data.ts \
  app/tests/lib/game/five-oh-one-play.data.test.ts \
  app/src/layouts/GameLayout.astro app/src/pages/games/501/play/index.astro
git commit -m "Show 501's configured leg count in the play-page title"
```

---

### Task 4: Side-by-side checkout-confirm buttons

**Files:**
- Modify: `app/src/components/layout/games/CheckoutConfirm.astro:98-113`

**Interfaces:**
- Consumes: nothing new — same `confirmDouble()`/`cancelCheckout()`
  handlers and `dartsAtDouble === null || dartsToFinish === null` disabled
  condition already on the page scope.
- Produces: nothing new — layout-only change.

The footer currently stacks Confirm above Cancel. Every other confirm
dialog in the app (`ConfirmDialog.astro`, per `07-Style-Guide.md`'s
documented convention) puts cancel on the left (ghost), confirm on the
right (primary), in a `justify-end gap-3` row with each button `w-1/3`.
Match that.

- [ ] **Step 1: Replace the footer block**

Current:

```astro
  <div
    slot="footer"
    class="mt-6 flex flex-col gap-3"
  >
    <Button
      variant="primary"
      title="Confirm"
      @click="confirmDouble()"
      :disabled="dartsAtDouble === null || dartsToFinish === null"
    />
    <Button
      variant="ghost"
      title="Cancel"
      @click="cancelCheckout()"
    />
  </div>
```

Replace with:

```astro
  <div
    slot="footer"
    class="mt-6 flex justify-end gap-3"
  >
    <Button
      variant="ghost"
      class="w-1/3"
      title="Cancel"
      @click="cancelCheckout()"
    />
    <Button
      variant="primary"
      class="w-1/3"
      title="Confirm"
      @click="confirmDouble()"
      :disabled="dartsAtDouble === null || dartsToFinish === null"
    />
  </div>
```

- [ ] **Step 2: Run the Astro conventions and class-composition checks**

```bash
bash scripts/check-astro-conventions.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-style-tokens.sh
```

Expected: all three pass.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/CheckoutConfirm.astro
git commit -m "Put 501's checkout-confirm buttons side by side"
```

---

### Task 5: Full validation, manual verification, and context maintenance

**Files:** none new — this task runs checks and confirms doc/decision
state, per the design spec's own Context Maintenance section (which found
no doc/decision/component-inventory edit is needed for this part).

- [ ] **Step 1: Run the full validation chain**

```bash
cd app && npm run validate:app
```

Expected: every step exits 0, including `npx fallow`, and the type gate
reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Run the full test suite**

```bash
cd app && npm test
```

Expected: all tests pass, including the new `matchTitle` cases from Task 3.

- [ ] **Step 3: Format check**

```bash
cd app && npm run format
npm run format:check
```

Expected: `format:check` reports clean (no diffs left after `format`).

- [ ] **Step 4: Manual verification in a browser**

Per `app/CLAUDE.md`, start the dev server in the background and exercise
the golden path:

```bash
cd app && astro dev --background
```

In a browser, open the 501 setup page, start a solo session, and a 1v1
session (add a guest), and confirm:
- The 1v1 scoreboard no longer shows the leg-count dot row under each
  seat's score (the leg-wins badge above the number is still there).
- The play-page header reads "FIRST TO N LEGS" (N = the configured leg
  count) instead of "501", for both solo and 1v1.
- Both "Previous" stat rows (solo and each 1v1 seat) read "Previous", not
  "Previous score".
- On a checkout attempt (score the leg out, or bring remaining to exactly
  0), the "Finished on a double?" dialog shows Cancel on the left, Confirm
  on the right, side by side.

Stop the dev server when done:

```bash
astro dev stop
```

- [ ] **Step 5: Confirm no context-maintenance doc edit is missing**

Per the spec's Context Maintenance section, this part needs no new
decision, pattern, or component-inventory row. Confirm that's still true
(no new shared component was introduced, no new architectural rule):

```bash
git diff --stat main...HEAD
```

Expected: only the five files touched by Tasks 1-4 plus this plan's test
file — nothing under `decisions/`, `docs/architecture/`, or `FINDINGS.md`.

- [ ] **Step 6: Run the full gate suite**

```bash
bash scripts/check-context-map.sh
```

Expected: passes (this part touches no `docs/architecture/` file, so this
is a confirmation, not expected to find anything to fix).

- [ ] **Step 7: Final commit (if Steps 3's format run produced any diff)**

```bash
git add -A
git status --short
```

If this shows any unstaged diff from the format run, commit it:

```bash
git commit -m "Format check"
```

If it shows nothing, skip this step — Tasks 1-4's commits already cover
everything.

---

## Self-Review Notes

- **Spec coverage:** all four Part-A items (leg dots, dynamic title,
  "Previous" label, checkout-confirm buttons) map to Tasks 1, 3, 2, 4
  respectively. The spec's "no doc/decision edit needed" conclusion is
  verified, not just assumed, in Task 5.
- **Type consistency:** `matchTitle(this: FiveOhOnePlayContext): string`
  is declared identically in `types.ts` (Task 3, Step 3) and implemented
  identically in `five-oh-one-play.data.ts` (Task 3, Step 4); `GameLayout`'s
  `gameTitleExpr?: string` prop name matches between the `Props` interface
  and its one call site in `pages/games/501/play/index.astro`.
- **No placeholders:** every step above shows the literal code to write,
  not a description of it.
