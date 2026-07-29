# Design — Alpine Loading State & Button Misusage (issues #49, #50)

> Status: proposed design (point-in-time task spec; non-canonical).
> Date: 2026-07-28.
> Scope: fix two broken loading spinners (Score Training "Let's play", in-game exit/abandon confirm), standardize a `loading` field across Alpine stores, and fix three `Button.astro` misusages found by a full-codebase button audit (#49's blank Retry button, plus two accessibility/consistency gaps found in the same pass).
> Relates to: GitHub issues [#50](https://github.com/levibroeksma/dart-analytics/issues/50), [#49](https://github.com/levibroeksma/dart-analytics/issues/49).

---

## 1. Background & Motivation

Issue #50 reports the loading spinner not appearing on click for two buttons — Score Training setup's "Let's play" and the in-game "kill session" (exit/abandon) confirm — while login/logout work correctly. The issue author's own diagnosis: "missing `loading` in the corresponding alpine file."

Investigation found two distinct, unrelated defects, not one:

1. **"Let's play" (`SetupSessionForm.astro`)** — `scoreTrainingSetup()` already declares and correctly toggles `loading`, and the button's `:disabled="loading"` binding works. But the button passes no icon slot at all (unlike `LogoutButton.astro`, which manually wires `iconBefore`/`iconAfter` `LoadingIcon`s). `Button.astro`'s title span correctly hides (`x-show="!loading"`), but nothing replaces it — the button just goes blank while loading, which reads as "no spinner."

2. **Exit/abandon confirm (`ExitModal.astro` via `GameLayout.astro`)** — `GameLayout.astro` wraps its exit-confirm modal in its own isolated `x-data="{ showExitModal: false }"`, a sibling scope to the page's own `x-data="scoreTrainingPlay()"` (which owns the actual abandon logic and its `abandonLoading` flag). Alpine scope only flows outward-to-inward through the DOM tree; the modal, rendered inside `GameLayout`'s wrapper rather than inside the page's `x-data`, cannot see `abandonLoading` at all. `Button.astro`'s `x-show="!loading"` evaluates against `undefined` in that scope — always truthy — so the title never hides and the spinner (once one exists) would never show either. `abandonLoading` was confirmed dead: set and read only inside `score-training-play.data.ts` itself, never bound in any template.

Neither `auth.store.ts` nor `game.store.ts` has a `loading` field today. `ContinueSessionModal.astro` was checked and found NOT to have the scope-isolation bug — it renders inside the setup page's own `x-data="scoreTrainingSetup()"`, not behind an isolating wrapper.

### 1.1 Issue #49 and a full-codebase button audit

Issue #49 ("Ending session modal"): "Uses deprecated buttons, title not showing." Every `<Button>`/`<button>` usage under `app/src` was read and checked against `Button.astro`'s current API (a `title` prop rendered in a `<span x-show="!loading">`, with `iconBefore`/`iconAfter` named slots — no default `<slot />`). Three real defects found:

1. **`app/src/pages/games/score-training/play/index.astro`'s "Retry" button** (shown when session-cleanup/reconciliation fails — the closest thing to an "ending session" flow in this codebase) passes its label as default slotted children instead of a `title` prop:
   ```astro
   <Button type="button" class="mt-4" @click="retryReconciliation()">
     Retry
   </Button>
   ```
   `Button.astro` has no default `<slot />`, so "Retry" is silently dropped and the button renders completely blank — this is issue #49's "title not showing," and the stale children-based usage (predating the `title`-prop API) is its "deprecated buttons." The near-identical Retry button on the *setup* page (`setup/index.astro`) already uses `title="Retry"` correctly — this one call site didn't get migrated.

2. **`LogoutButton.astro`** is icon-only (no `title`) but passes neither `ariaLabel` nor `icon`, even though `Button.astro`'s own doc comment states `ariaLabel` is "required for icon-only." It currently has no accessible name for assistive tech.

3. **`GameLayout.astro`'s header exit button** is a raw `<button>` manually duplicating `Button.astro`'s icon-only styling (`btn btn-ghost p-2`) instead of using `<Button icon ariaLabel="Exit game">`. It already carries its own correct `aria-label`, so this is a consistency/duplication gap, not a functional or accessibility bug.

Every other `Button.astro` call site (`ConfirmDialog.astro`, `ContinueSessionModal.astro`, `ScoreTrainingResults.astro`, `SetupSessionForm.astro`, `ScoreInput.astro`, `login/index.astro`) was checked and uses the current `title`-prop API correctly.

---

## 2. Decisions (brainstorming)

| Topic | Choice |
| ----- | ------ |
| Store `loading` fields | Add to both `auth.store.ts` and `game.store.ts`, even where no current bug requires it — matches the stated policy and makes `$store.*.loading` reachable from any Alpine scope regardless of DOM nesting |
| Spinner rendering | Built into `Button.astro` itself (new spinner icon, shown via `x-show={loadingExpr}`) rather than requiring every call site to manually wire icon slots — closes this whole bug class for future buttons too |
| Cross-scope loading (exit modal) | `Button.astro` gains an optional `loadingExpr?: string` prop (default `"loading"`); `ConfirmDialog.astro` forwards it to its Confirm button only; `ExitModal.astro` passes `loadingExpr="$store.game.loading"` — not a GameLayout restructure |
| `login.data.ts` / `logout.data.ts` | Left untouched — they already work correctly with their own local `loading`; `auth.store.ts`'s new field is additive, not a migration of working code |
| `abandonLoading` | Retired entirely in favor of `$store.game.loading` — it was dead (never template-bound), and the store field now serves the same purpose reactively |
| Button audit findings | All three folded into this spec (not split out): the blank Retry button (#49), `LogoutButton.astro`'s missing `ariaLabel`, and `GameLayout.astro`'s raw duplicate exit button — each is a one-call-site fix, too small to warrant separate specs |

---

## 3. Scope

**In:**

- `app/src/stores/auth.store.ts` — `loading: false`; set/cleared in `init()`, `signIn()`, `signOut()`.
- `app/src/stores/game.store.ts` — `loading: false`; also cleared in `reset()`.
- `app/src/lib/game/types.ts` — `ScoreTrainingPlayContext`: remove `abandonLoading: boolean`; add `loading: boolean` to its inline `$store.game` structural type.
- `app/src/lib/game/score-training-play.data.ts` — `abandonAndExit()`'s guard/toggle moves from `this.abandonLoading` to `this.$store.game.loading`.
- `app/src/components/forms/Button.astro` — new `loadingExpr?: string` prop (default `"loading"`); built-in spinner icon (`@icons/loading.svg`); title span's `x-show` becomes `!(${loadingExpr})`.
- `app/src/components/ui/ConfirmDialog.astro` — new optional `loadingExpr?: string` prop, forwarded only to the Confirm `Button`.
- `app/src/components/layout/games/ExitModal.astro` — passes `loadingExpr="$store.game.loading"` to its `ConfirmDialog`.
- `app/src/pages/games/score-training/play/index.astro` — Retry button gets `title="Retry"`, empty children removed (closes #49).
- `app/src/components/ui/LogoutButton.astro` — adds `icon` and `ariaLabel="Log out"`.
- `app/src/layouts/GameLayout.astro` — exit button replaced with `<Button icon ariaLabel="Exit game">`.
- Test updates: `app/tests/stores/auth.store.test.ts`, `app/tests/stores/game.store.test.ts`, `app/tests/lib/game/score-training-play.data.test.ts`.

**Out:**

- `login.data.ts`, `logout.data.ts` — unchanged, already correct.
- `SetupSessionForm.astro` — no change; the built-in `Button.astro` spinner covers it automatically since `loading`/`:disabled` are already correctly wired there.
- `ContinueSessionModal.astro` — no change; confirmed already correctly scoped.
- `stores/types.ts` — no change; the game/auth store shapes are consumed via structural/`ReturnType<>` inference elsewhere, which picks up the new fields automatically.
- Adding `:disabled` bindings to `ConfirmDialog`'s buttons — out of scope for this bug (spinner visibility, not click-guarding); `abandonAndExit()`'s existing internal guard (`if (this.$store.game.loading) return;`) already makes a double-click safe without a visible disabled state.
- Restructuring `GameLayout.astro`'s scope — rejected approach; the configurable `loadingExpr` prop achieves the fix without touching every page that uses `GameLayout`.
- `InputButton.astro` (game keypad digits/undo/delete) and `NavBtn.astro` (bottom-nav links) — audited and found to be deliberately separate components for different purposes (a numeric-pad button shell, an `<a>` nav link), not `Button.astro` misusages.

---

## 4. `Button.astro` changes

Add prop:

```ts
interface Props {
  // ...existing props
  loadingExpr?: string; // Alpine expression evaluating to a boolean; default "loading"
}
```

```ts
const { /* ...existing */, loadingExpr = "loading" }: Props = Astro.props;
```

Template: import `LoadingIcon` from `@icons/loading.svg` (same icon `IsLoading.astro` and `LogoutButton.astro` already use). Change the title span's `x-show` from the literal `"!loading"` to the interpolated `` `!(${loadingExpr})` ``, and add a spinner element shown via `x-show={loadingExpr}`, both `x-cloak`. `iconBefore`/`iconAfter` slots are untouched — call sites that manually manage custom icons (like `LogoutButton.astro`) keep full control; the built-in spinner only fills the gap when no such slot content is provided.

`:disabled` remains entirely caller-controlled via the existing `{...props}` passthrough (unchanged) — `Button.astro` never binds `disabled` to `loadingExpr` itself.

---

## 5. `ConfirmDialog.astro` / `ExitModal.astro` changes

`ConfirmDialog.astro` adds:

```ts
interface Props {
  // ...existing props
  loadingExpr?: string;
}
```

Forwarded only to the Confirm `Button` (`loadingExpr={loadingExpr}`); the Cancel `Button` is untouched (never shows a spinner). When `loadingExpr` is `undefined`, `Button.astro`'s own default (`"loading"`) applies — every existing `ConfirmDialog` call site (finish-confirm, continue-session's two-button footer, which doesn't use `ConfirmDialog` at all) keeps its current behavior unless it explicitly opts in.

`ExitModal.astro` passes `loadingExpr="$store.game.loading"` on its `ConfirmDialog` usage — the one call site that actually needs cross-scope reactivity, since it's rendered inside `GameLayout`'s isolated wrapper scope.

---

## 6. Store & data-file changes

`auth.store.ts`:

```ts
export function authStore() {
  return {
    status: "checking" as AuthStatus,
    ready: false,
    loading: false,

    async init() {
      this.loading = true;
      // ...existing body...
      this.loading = false;
    },
    async signIn(email: string, password: string) {
      this.loading = true;
      try {
        // ...existing body...
      } finally {
        this.loading = false;
      }
    },
    async signOut() {
      this.loading = true;
      try {
        await authClient.signOut();
        this.status = "anonymous";
      } finally {
        this.loading = false;
      }
    },
  };
}
```

(`init()`'s two early-`return` branches both navigate away via `location.replace`, so `this.loading = false` on those paths is moot — the page unloads — but the happy path at the end still needs it.)

`game.store.ts`: add `loading: false` as a plain (non-`persist()`) field; `reset()` gains `this.loading = false;`.

`score-training-play.data.ts` / `types.ts`: `abandonAndExit()`'s three touches of `this.abandonLoading` (guard, set-true, set-false-on-catch) become `this.$store.game.loading`. `ScoreTrainingPlayContext` drops `abandonLoading: boolean` and adds `loading: boolean;` to its `$store.game` structural type block.

---

## 7. Button misusage fixes (issue #49 + audit)

**`play/index.astro`'s Retry button** — find:
```astro
<Button type="button" class="mt-4" @click="retryReconciliation()">
  Retry
</Button>
```
replace with the self-closing, `title`-prop form used everywhere else:
```astro
<Button type="button" class="mt-4" @click="retryReconciliation()" title="Retry" />
```

**`LogoutButton.astro`** — add `icon` (square icon-only padding, matching every other icon-only `Button.astro` usage) and `ariaLabel="Log out"` (the component's own doc comment already documents this as required for icon-only buttons):
```astro
<Button
  type="button"
  variant="ghost"
  icon
  ariaLabel="Log out"
  x-data="logoutButton()"
  @click="submit"
  :disabled="loading"
>
```

**`GameLayout.astro`'s exit button** — find:
```astro
<button
  type="button"
  class="relative z-10 btn btn-ghost p-2"
  aria-label="Exit game"
  @click="showExitModal = true"
>
  <ExitIcon class="size-6 text-muted" />
</button>
```
replace with the shared component, preserving the existing `aria-label` text and click handler, dropping the manually-duplicated `btn btn-ghost p-2` classes (now supplied by `Button.astro`'s own `icon` prop) and the `relative z-10` positioning (kept as an override, since it's layout-specific to the header):
```astro
<Button
  type="button"
  variant="ghost"
  icon
  ariaLabel="Exit game"
  class="relative z-10"
  @click="showExitModal = true"
>
  <ExitIcon class="size-6 text-muted" slot="iconBefore" />
</Button>
```

---

## 8. Testing

`.astro` files carry no unit-test coverage in this repo (D101 — no Astro component test runner); the `Button.astro`/`ConfirmDialog.astro`/`ExitModal.astro`/`GameLayout.astro`/`LogoutButton.astro`/`play/index.astro` changes are all verified by running the app (setup page "Let's play" click, in-game exit-confirm click, play-page Retry button after a failed reconciliation, logout button's rendered `aria-label`, exit button's visual/click parity) rather than Vitest, per existing convention.

Covered by Vitest:
- `auth.store.test.ts` — new cases asserting `loading` is `true` during `signIn`/`signOut`/`init` and `false` after (success and, for `signIn`, the throw path).
- `game.store.test.ts` — new case asserting `loading` defaults `false` and is cleared by `reset()`.
- `score-training-play.data.test.ts` — existing `abandonAndExit` tests updated to assert against `store.game.loading` instead of the removed `abandonLoading`, plus the existing double-invocation guard test re-pointed at the same guarantee (guard fires on `$store.game.loading`, not the deleted field) — per this repo's Hard Invariant, a removed field's test gets re-pointed at the same guarantee, never a different one just to stay green.

---

## 9. Success criteria

- Clicking "Let's play" on Score Training setup shows a spinner (button goes into a visibly-loading state, not blank) until navigation/error.
- Clicking "Leave" in the in-game exit-confirm modal shows a spinner on the Confirm button until the abandon completes or errors.
- `login`/`logout` buttons' existing spinner behavior is unchanged.
- The play-page Retry button (shown on a failed session reconciliation) renders visible "Retry" text instead of a blank button.
- The logout button and the in-game exit button both expose a correct accessible name (`aria-label`) and use `Button.astro`'s `icon` sizing.
- `cd app && npm test` passes with the updated/new test cases.
- `npm run check` (astro check) reports 0 errors after the `Props`/type changes.
