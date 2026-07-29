# Bottom Nav Active Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bottom nav's active-item highlighting so it stays applied on nested routes (issue #51) — currently only exact top-level path matches work, so the Games nav item loses its active state on `/games/score-training/setup` and `/games/score-training/play`.

**Architecture:** `NavBtn.astro` auto-derives a `matchPrefix` (`${href}/`) from its own `href` whenever the caller doesn't pass one explicitly, so `BottomNav.astro` never needs to remember to wire this per item. Root (`/`) is exempted from auto-prefixing since a prefix of `/` would match every route. `isNavActive()` itself is unchanged — a pure, explicit matcher.

**Tech Stack:** Astro, TypeScript, Vitest.

## Global Constraints

- `.astro` files carry no unit-test coverage in this repo (D101 — no Astro component test runner); `NavBtn.astro`'s change is verified by running the dev server, not Vitest.
- Test files for `app/src/lib/utils/*.ts` live at `app/tests/utils/*.test.ts` (this repo's established exception — confirmed against `auth-routes.test.ts` and `route-class.test.ts` — not the literal `app/tests/lib/utils/` mirror).
- The auto-derived prefix is `${href}/` (trailing slash required), never bare `href` — prevents a route sharing a prefix string (e.g. a hypothetical `/games-archive`) from falsely matching `/games`'s prefix.

---

### Task 1: Test coverage for `isNavActive()`

**Files:**
- Create: `app/tests/utils/is-nav-active.test.ts`

**Interfaces:**
- Consumes: `isNavActive(pathname: string, href: string, matchPrefix?: string): boolean`, exported from `app/src/lib/utils/is-nav-active.ts` (existing, unmodified by this task).
- Produces: nothing new — this task adds test coverage for existing, already-correct behavior, proving the matcher does what Task 2's `NavBtn.astro` change will rely on. No RED step here since the function under test isn't changing; each test is written to pass immediately against the current implementation.

- [ ] **Step 1: Write the tests**

Create `app/tests/utils/is-nav-active.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isNavActive } from "@utils/is-nav-active";

describe("isNavActive", () => {
  it("matches an exact pathname with no matchPrefix", () => {
    expect(isNavActive("/games", "/games")).toBe(true);
  });

  it("does not match an unrelated pathname with no matchPrefix", () => {
    expect(isNavActive("/statistics", "/games")).toBe(false);
  });

  it("matches a nested path when matchPrefix covers it", () => {
    expect(
      isNavActive("/games/score-training/setup", "/games", "/games/"),
    ).toBe(true);
  });

  it("does not match a nested path when no matchPrefix is given", () => {
    expect(isNavActive("/games/score-training/setup", "/games")).toBe(false);
  });

  it("a root matchPrefix of '/' must not match every route", () => {
    expect(isNavActive("/statistics", "/", "/")).toBe(true);
  });

  it("a prefix string that is a literal substring of another route must require the trailing separator to avoid a false match", () => {
    expect(isNavActive("/games-archive", "/games", "/games/")).toBe(false);
    expect(isNavActive("/games-archive", "/games", "/games")).toBe(true);
  });
});
```

(The 5th test documents WHY the design in this plan's Task 2 always auto-derives `${href}/` — with a trailing slash — never bare `href`: passing bare `"/"` as `matchPrefix` would make every route match, which is exactly the bug this whole plan exists to avoid re-introducing. The 6th test proves the trailing-slash requirement is what keeps `/games` from swallowing an unrelated `/games-archive` route.)

- [ ] **Step 2: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/utils/is-nav-active.test.ts`
Expected: PASS — all 6 tests (no implementation change needed; `isNavActive()` already behaves this way).

- [ ] **Step 3: Commit**

```bash
git add app/tests/utils/is-nav-active.test.ts
git commit -m "test: cover isNavActive's exact/prefix/edge-case matching"
```

---

### Task 2: Auto-derive `matchPrefix` in `NavBtn.astro` (closes #51)

**Files:**
- Modify: `app/src/components/layout/NavBtn.astro`

**Interfaces:**
- Consumes: `isNavActive()` from Task 1 (unchanged), `Astro.url.pathname`, the existing `href`/`matchPrefix` props.
- Produces: `NavBtn.astro`'s `active` computation now reflects nested routes for any non-root `href`, with no change required in `BottomNav.astro` or any other caller.

- [ ] **Step 1: Implement**

In `app/src/components/layout/NavBtn.astro`, find:

```ts
// Styles
const active = isNavActive(Astro.url.pathname, href, matchPrefix);
```

Replace with:

```ts
// Styles
const effectiveMatchPrefix =
  matchPrefix ?? (href === "/" ? undefined : `${href}/`);
const active = isNavActive(Astro.url.pathname, href, effectiveMatchPrefix);
```

- [ ] **Step 2: Verify gates pass**

Run: `bash scripts/check-astro-conventions.sh`
Expected: `OK: Astro x-show/x-cloak pairing and no template HTML comments.`

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 3: Manual verification (no Astro component test runner in this repo)**

Start the dev server: `cd app && astro dev --background`, confirm with `astro dev status`.

- Visit `/` — expected: only the Home nav item is highlighted (`text-accent`, `aria-current="page"`); Games/Stats/Profile are not.
- Visit `/games` — expected: only Games is highlighted.
- Visit `/games/score-training/setup` — expected: Games stays highlighted (this is the bug fix — before this change, no nav item would be highlighted here).
- Visit `/games/score-training/play` (requires an active session to reach without redirect; if reaching it live isn't practical in this environment, inspect the rendered `class`/`aria-current` on the Games `<a>` element via the page's HTML output instead) — expected: Games stays highlighted.
- Visit `/statistics` and `/profile` — expected: each highlights only itself, matching pre-existing (already-correct, exact-match) behavior.

Stop the dev server: `cd app && astro dev stop`.

- [ ] **Step 4: Run the full test suite**

Run: `cd app && npm test`
Expected: all tests pass, including Task 1's new file.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/NavBtn.astro
git commit -m "fix: auto-derive nav active-state prefix so nested routes stay highlighted"
```

---

### Task 3: Final validation pass

**Files:** none — this task only runs verification.

**Interfaces:** none.

- [ ] **Step 1: Run all gate scripts**

Run: `for s in scripts/check-*.sh; do bash "$s" || echo "FAILED: $s"; done` (from the repo root)
Expected: zero `FAILED:` lines across all 14 scripts.

- [ ] **Step 2: Run the full app validation**

Run: `cd app && npm test && npm run check`
Expected: all tests pass; 0 type errors.

- [ ] **Step 3: Format gate**

Run: `cd app && npm run format && npm run format:check`
Expected: `format` produces no diffs (or commit them if it does); `format:check` clean.

- [ ] **Step 4: Report**

Confirm in the completion report: the manual dev-server verification results from Task 2 Step 3 (which routes were actually checked in this environment, and whether `/games/score-training/play` required inspecting rendered HTML instead of a live authenticated click-through), plus the full gate/test/check output.
