# Test Tree & Variant Inlining Convention Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every `app/` Vitest test out of colocation into a mirrored `app/tests/` tree, and inline `Button.astro`'s variant map into its own frontmatter instead of a separate testable helper — then update every canonical doc that mandated the old conventions.

**Architecture:** This is a pure relocation + import-path rewrite, not a behavior change: test bodies (assertions, mocks) are untouched, only their file location and the import path to the module under test change. `vitest.config.ts`'s `include` glob is widened first (so both old and new locations resolve during the migration), then narrowed to only `tests/**/*.test.ts` once every file has moved. The one exception is `Button.astro`'s variant map, which loses its dedicated test file entirely (accepted trade-off, no Astro-component test runner exists in this project).

**Tech Stack:** Astro, TypeScript, Vitest, existing `tsconfig.json`/`vitest.config.ts` path aliases.

## Global Constraints

- Test *content* (assertions, `describe`/`it` blocks, mocks) must not change — only file location and the import path to the module under test.
- `app/tests/` mirrors `app/src/` and `app/scripts/`, dropping the leading `src/` segment (e.g. `app/src/stores/auth.store.test.ts` → `app/tests/stores/auth.store.test.ts`; `app/scripts/seed-dev-auth.test.ts` → `app/tests/scripts/seed-dev-auth.test.ts`).
- Relocated tests import their subject module via the existing `tsconfig.json`/`vitest.config.ts` path aliases (`@stores`, `@client`, `@utils`, `@types`, `@pages`, `@components`), not relative paths — except `tests/scripts/seed-dev-auth.test.ts`, which has no alias available and uses a relative path instead.
- `Button.astro`'s variant map is inlined into its own frontmatter; `button-variants.ts` and `button-variants.test.ts` are deleted with no replacement test.
- Only canonical docs are updated (`app/CLAUDE.md`, `07-Frontend/10-Frontend-Agent-Guide.md`, `DECISIONS.md`, `00-Context-Map.md`). Historical docs under `docs/superpowers/` are never rewritten.
- Run `npm test` after every task; the passing-test count must match the expected count stated in that task (it drops by exactly 1, from 35 to 34, the task that deletes `button-variants.test.ts` — every other task's count is unchanged by relocation).

---

## File Structure

- Modify: `app/vitest.config.ts` — widen then narrow `include`; add `@components` alias.
- Modify: `app/src/components/forms/Button.astro` — inline variant map.
- Delete: `app/src/components/forms/button-variants.ts`, `app/src/components/forms/button-variants.test.ts`.
- Move (10 files): every other `*.test.ts` under `app/src/` and `app/scripts/` into the mirrored `app/tests/` tree, with one import line (or two, for `players.test.ts`) rewritten per file.
- Modify: `app/CLAUDE.md`, `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`, `DECISIONS.md`, `docs/architecture/00-Context-Map.md`.

---

### Task 1: Vitest config prep

**Files:**
- Modify: `app/vitest.config.ts`

**Interfaces:**
- Produces: `@components` alias resolving to `app/src/components`, and an `include` glob that additionally matches `tests/**/*.test.ts` (old patterns stay for now — removed in Task 7 once every file has moved).

- [ ] **Step 1: Widen `include` and add the `@components` alias**

Replace `app/vitest.config.ts` in full:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, './src/lib/client'),
      '@components': path.resolve(__dirname, './src/components'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@forms': path.resolve(__dirname, './src/forms'),
      '@types': path.resolve(__dirname, './src/types'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@pages': path.resolve(__dirname, './src/pages'),
    },
  },
});
```

- [ ] **Step 2: Run the full suite to confirm nothing broke**

Run: `cd app && npm test`
Expected: `Test Files 11 passed (11)`, `Tests 35 passed (35)` — unchanged from before this step; `tests/` doesn't exist yet so the new glob entry matches nothing.

- [ ] **Step 3: Commit**

```bash
git add app/vitest.config.ts
git commit -m "chore(app): widen vitest include for tests/ tree, add @components alias"
```

---

### Task 2: Inline Button.astro's variant map; delete the helper

**Files:**
- Modify: `app/src/components/forms/Button.astro`
- Delete: `app/src/components/forms/button-variants.ts`
- Delete: `app/src/components/forms/button-variants.test.ts`

**Interfaces:**
- Consumes: none (self-contained).
- Produces: `Button.astro` renders identically (`btn`, `btn-primary`/`btn-secondary`/`btn-ghost`, caller class) — no consumer of `Button.astro` needs any change, since its external `Props` shape is unchanged.

- [ ] **Step 1: Inline the variant map into `Button.astro`**

Replace `app/src/components/forms/Button.astro` in full:

```astro
---
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit' | 'reset';
  class?: string;
  [key: string]: unknown;
}

// Props
const {
  variant = 'primary',
  type = 'button',
  class: classNameProp,
  ...rest
}: Props = Astro.props;

// Lib
import { cn } from '@client/cn';

// Styles
const VARIANT_CLASS: Record<'primary' | 'secondary' | 'ghost', string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};
const className = cn('btn', VARIANT_CLASS[variant], classNameProp);
---

<button type={type} class={className} {...rest}>
  <slot />
</button>
```

- [ ] **Step 2: Delete the now-unused helper and its test**

```bash
git rm app/src/components/forms/button-variants.ts app/src/components/forms/button-variants.test.ts
```

- [ ] **Step 3: Run the full suite**

Run: `cd app && npm test`
Expected: `Test Files 10 passed (10)`, `Tests 34 passed (34)` — one file and one test fewer than Task 1's baseline (`button-variants.test.ts` is gone).

- [ ] **Step 4: Run `astro check` to confirm `Button.astro` still type-checks and nothing imports the deleted file**

Run: `cd app && npx astro check`
Expected: `0 errors, 0 warnings, 0 hints`

- [ ] **Step 5: Commit**

```bash
git add app/src/components/forms/Button.astro
git commit -m "refactor(app): inline Button variant map, drop button-variants helper"
```

---

### Task 3: Relocate `utils/` tests

**Files:**
- Move: `app/src/utils/auth-routes.test.ts` → `app/tests/utils/auth-routes.test.ts`
- Move: `app/src/utils/route-class.test.ts` → `app/tests/utils/route-class.test.ts`

**Interfaces:** none (pure relocation; both files' subject modules stay at `app/src/utils/auth-routes.ts` and `app/src/utils/route-class.ts`, unchanged).

- [ ] **Step 1: Move the files**

```bash
mkdir -p app/tests/utils
git mv app/src/utils/auth-routes.test.ts app/tests/utils/auth-routes.test.ts
git mv app/src/utils/route-class.test.ts app/tests/utils/route-class.test.ts
```

- [ ] **Step 2: Fix the import in each moved file**

In `app/tests/utils/auth-routes.test.ts`, change:

```ts
import { isPublicPage, normalizePath, PUBLIC_PAGES } from './auth-routes';
```

to:

```ts
import { isPublicPage, normalizePath, PUBLIC_PAGES } from '@utils/auth-routes';
```

In `app/tests/utils/route-class.test.ts`, change:

```ts
import { classifyRoute } from './route-class';
```

to:

```ts
import { classifyRoute } from '@utils/route-class';
```

- [ ] **Step 3: Run the full suite**

Run: `cd app && npm test`
Expected: `Test Files 10 passed (10)`, `Tests 34 passed (34)` — same totals as Task 2 (two files moved, zero net change in what's discovered).

- [ ] **Step 4: Commit**

```bash
git add app/tests/utils app/src/utils/auth-routes.test.ts app/src/utils/route-class.test.ts
git commit -m "test(app): relocate utils tests to app/tests/"
```

---

### Task 4: Relocate `lib/client/` tests

**Files:**
- Move: `app/src/lib/client/cn.test.ts` → `app/tests/lib/client/cn.test.ts`
- Move: `app/src/lib/client/api/client.test.ts` → `app/tests/lib/client/api/client.test.ts`
- Move: `app/src/lib/client/api/players.test.ts` → `app/tests/lib/client/api/players.test.ts`

**Interfaces:** none (pure relocation; subject modules `app/src/lib/client/cn.ts`, `app/src/lib/client/api/client.ts`, `app/src/lib/client/api/players.ts` unchanged).

- [ ] **Step 1: Move the files**

```bash
mkdir -p app/tests/lib/client/api
git mv app/src/lib/client/cn.test.ts app/tests/lib/client/cn.test.ts
git mv app/src/lib/client/api/client.test.ts app/tests/lib/client/api/client.test.ts
git mv app/src/lib/client/api/players.test.ts app/tests/lib/client/api/players.test.ts
```

- [ ] **Step 2: Fix the import in `app/tests/lib/client/cn.test.ts`**

Change:

```ts
import { cn } from './cn';
```

to:

```ts
import { cn } from '@client/cn';
```

- [ ] **Step 3: Fix the import in `app/tests/lib/client/api/client.test.ts`**

Change:

```ts
import { apiRequest } from './client';
```

to:

```ts
import { apiRequest } from '@client/api/client';
```

- [ ] **Step 4: Fix the imports in `app/tests/lib/client/api/players.test.ts`**

Change:

```ts
vi.mock('./client', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from './client';
import { provision, ProvisionError } from './players';
```

to:

```ts
vi.mock('@client/api/client', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '@client/api/client';
import { provision, ProvisionError } from '@client/api/players';
```

- [ ] **Step 5: Run the full suite**

Run: `cd app && npm test`
Expected: `Test Files 10 passed (10)`, `Tests 34 passed (34)`.

- [ ] **Step 6: Commit**

```bash
git add app/tests/lib app/src/lib/client/cn.test.ts app/src/lib/client/api/client.test.ts app/src/lib/client/api/players.test.ts
git commit -m "test(app): relocate lib/client tests to app/tests/"
```

---

### Task 5: Relocate `stores/`, `pages/login/`, `components/ui/` tests

**Files:**
- Move: `app/src/stores/auth.store.test.ts` → `app/tests/stores/auth.store.test.ts`
- Move: `app/src/pages/login/login.data.test.ts` → `app/tests/pages/login/login.data.test.ts`
- Move: `app/src/components/ui/logout.data.test.ts` → `app/tests/components/ui/logout.data.test.ts`

**Interfaces:** none (pure relocation; subject modules `app/src/stores/auth.store.ts`, `app/src/pages/login/login.data.ts`, `app/src/components/ui/logout.data.ts` unchanged).

- [ ] **Step 1: Move the files**

```bash
mkdir -p app/tests/stores app/tests/pages/login app/tests/components/ui
git mv app/src/stores/auth.store.test.ts app/tests/stores/auth.store.test.ts
git mv app/src/pages/login/login.data.test.ts app/tests/pages/login/login.data.test.ts
git mv app/src/components/ui/logout.data.test.ts app/tests/components/ui/logout.data.test.ts
```

- [ ] **Step 2: Fix the import in `app/tests/stores/auth.store.test.ts`**

Change:

```ts
import { authStore } from './auth.store';
```

to:

```ts
import { authStore } from '@stores/auth.store';
```

- [ ] **Step 3: Fix the import in `app/tests/pages/login/login.data.test.ts`**

Change:

```ts
import {
  loginForm,
  mapProvisionError,
  mapSignInError,
  type LoginFormContext,
} from './login.data';
```

to:

```ts
import {
  loginForm,
  mapProvisionError,
  mapSignInError,
  type LoginFormContext,
} from '@pages/login/login.data';
```

- [ ] **Step 4: Fix the import in `app/tests/components/ui/logout.data.test.ts`**

Change:

```ts
import { logoutButton, type LogoutButtonContext } from './logout.data';
```

to:

```ts
import { logoutButton, type LogoutButtonContext } from '@components/ui/logout.data';
```

- [ ] **Step 5: Run the full suite**

Run: `cd app && npm test`
Expected: `Test Files 10 passed (10)`, `Tests 34 passed (34)`.

- [ ] **Step 6: Commit**

```bash
git add app/tests/stores app/tests/pages app/tests/components app/src/stores/auth.store.test.ts app/src/pages/login/login.data.test.ts app/src/components/ui/logout.data.test.ts
git commit -m "test(app): relocate stores/pages/components tests to app/tests/"
```

---

### Task 6: Relocate `types/api/` test

**Files:**
- Move: `app/src/types/api/players.test.ts` → `app/tests/types/api/players.test.ts`

**Interfaces:** none (pure relocation; subject module `app/src/types/api/players.ts` unchanged).

- [ ] **Step 1: Move the file**

```bash
mkdir -p app/tests/types/api
git mv app/src/types/api/players.test.ts app/tests/types/api/players.test.ts
```

- [ ] **Step 2: Fix the import**

Change:

```ts
import { ProvisionPlayerRequest, ProvisionPlayerResponse } from './players';
```

to:

```ts
import { ProvisionPlayerRequest, ProvisionPlayerResponse } from '@types/api/players';
```

- [ ] **Step 3: Run the full suite**

Run: `cd app && npm test`
Expected: `Test Files 10 passed (10)`, `Tests 34 passed (34)`.

- [ ] **Step 4: Commit**

```bash
git add app/tests/types app/src/types/api/players.test.ts
git commit -m "test(app): relocate types/api test to app/tests/"
```

---

### Task 7: Relocate `scripts/` test; narrow `vitest.config.ts`

**Files:**
- Move: `app/scripts/seed-dev-auth.test.ts` → `app/tests/scripts/seed-dev-auth.test.ts`
- Modify: `app/vitest.config.ts`

**Interfaces:** none (pure relocation; subject module `app/scripts/seed-dev-auth.ts` unchanged). This task also removes the now-unused `src/**/*.test.ts` and `scripts/**/*.test.ts` patterns from `vitest.config.ts`'s `include` — safe only now, since every test file under `src/` and `scripts/` has been moved or deleted by Tasks 2–6.

- [ ] **Step 1: Move the file**

```bash
mkdir -p app/tests/scripts
git mv app/scripts/seed-dev-auth.test.ts app/tests/scripts/seed-dev-auth.test.ts
```

- [ ] **Step 2: Fix the import (relative — no alias exists for `scripts/`)**

Change:

```ts
import { isAlreadyExistsError } from './seed-dev-auth';
```

to:

```ts
import { isAlreadyExistsError } from '../../scripts/seed-dev-auth';
```

- [ ] **Step 3: Narrow the `vitest.config.ts` include glob**

Replace the `test.include` line in `app/vitest.config.ts`:

```ts
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/**/*.test.ts'],
```

with:

```ts
    include: ['tests/**/*.test.ts'],
```

- [ ] **Step 4: Confirm no test files remain outside `app/tests/`**

Run: `cd app && find src scripts -name '*.test.ts'`
Expected: no output (empty).

- [ ] **Step 5: Run the full suite**

Run: `cd app && npm test`
Expected: `Test Files 10 passed (10)`, `Tests 34 passed (34)` — identical totals to Task 6, now sourced entirely from `include: ['tests/**/*.test.ts']`.

- [ ] **Step 6: Commit**

```bash
git add app/vitest.config.ts app/tests/scripts app/scripts/seed-dev-auth.test.ts
git commit -m "test(app): relocate scripts test, narrow vitest include to tests/"
```

---

### Task 8: Update canonical docs and run the completion gate

**Files:**
- Modify: `app/CLAUDE.md`
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`
- Modify: `DECISIONS.md`
- Modify: `docs/architecture/00-Context-Map.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update `app/CLAUDE.md`**

In the `## Test-Driven Development (mandatory)` section's `Rules` list, change:

```markdown
- Colocate tests as `*.test.ts` beside the module under test (same folder).
- Test pure functions, stores, clients, and utilities with Vitest mocks — no real network or Neon calls in unit tests.
- `.astro` markup: extract testable class/variant maps to a colocated `.ts` helper when the component has branching logic; do not skip TDD by marking UI tasks "manual only".
- Do not commit production code without its failing test written first (except greenfield scaffold commits that only add test infrastructure).
```

to:

```markdown
- Place tests under `app/tests/`, mirroring `app/src/`'s (and `app/scripts/`'s) directory structure — never colocated beside the module under test.
- Test pure functions, stores, clients, and utilities with Vitest mocks — no real network or Neon calls in unit tests.
- `.astro` markup: keep variant/branching logic inline in the component's own frontmatter. This logic is not unit-tested — there is no Astro-component test runner in this project — so do not extract a separate helper file solely to make it testable (D101).
- Do not commit production code without its failing test written first (except greenfield scaffold commits that only add test infrastructure).
```

- [ ] **Step 2: Update `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`**

Change:

```markdown
- Vitest only; colocate `*.test.ts` with the source file.
- Mock `@client/auth` and `fetch` in client/API tests — no live Neon calls.
- Stores, `@client/api/*`, `@utils/*`, Zod schemas: always unit-tested.
- `.astro` components with variant/branching logic: extract a colocated `.ts` helper (e.g. `button-variants.ts`) and test that helper; wire the component to the helper.
```

to:

```markdown
- Vitest only; place `*.test.ts` under `app/tests/`, mirroring `app/src/`'s directory structure — never colocated with the source file.
- Mock `@client/auth` and `fetch` in client/API tests — no live Neon calls.
- Stores, `@client/api/*`, `@utils/*`, Zod schemas: always unit-tested.
- `.astro` components with variant/branching logic: keep it inline in the component's own frontmatter (D101). This logic is untested — no Astro-component test runner exists in this project — accept that rather than extracting a helper solely for testability.
```

Then, in the same file's `# Pre-Completion Checklist` section, change:

```markdown
- [ ] TDD cycle complete: failing test → pass → `npm test` green
```

to:

```markdown
- [ ] TDD cycle complete: failing test → pass → `npm test` green (test lives under `app/tests/`, not colocated)
```

- [ ] **Step 3: Add `DECISIONS.md` entry `D101`**

Immediately after the existing `D100` row in the frontend decisions table, add:

```markdown
| D101 | 2026-07-15 | Reverse D99's test-colocation clause and the Frontend Agent Guide's variant-extraction guidance: tests move to a mirrored `app/tests/` tree (never colocated); `.astro` variant/branching logic stays inline in frontmatter instead of an extracted testable `.ts` helper (e.g. former `button-variants.ts`), accepting the resulting loss of Vitest coverage for that logic | Mirrored test tree matches conventional test-layout expectations; a dedicated helper file solely to make trivial variant logic testable was judged not worth the indirection |
```

- [ ] **Step 4: Update `docs/architecture/00-Context-Map.md`**

In the `# Current Implementation State` table, change the `Frontend docs` row:

```markdown
| Frontend docs | Handbook 0.1.0 (`01`–`05`, `10`) + overview 0.3.1 — prerender-default, Alpine factory, client auth gate (D98), auto-cleanup recovery, completed-batch outbox + `_v` store guard, `.astro` authoring conventions; prerendered protected shells decided public-by-design, JWT-gated API is the real boundary (D97, 2026-07-15) |
```

to:

```markdown
| Frontend docs | Handbook 0.1.0 (`01`–`05`, `10`) + overview 0.3.1 — prerender-default, Alpine factory, client auth gate (D98), auto-cleanup recovery, completed-batch outbox + `_v` store guard, `.astro` authoring conventions; prerendered protected shells decided public-by-design, JWT-gated API is the real boundary (D97, 2026-07-15); tests live under `app/tests/` (never colocated), `.astro` variant logic stays inline in frontmatter (D101, 2026-07-15) |
```

And the `Application code` row:

```markdown
| Application code | Auth middleware with route-class 401/403 handling, frozen envelope/error helpers, player provisioning (D76) complete; scaffold otherwise early |
```

to:

```markdown
| Application code | Auth middleware with route-class 401/403 handling, frozen envelope/error helpers, player provisioning (D76) complete; logout flow (`signOut`, `LogoutButton`) complete; scaffold otherwise early |
```

- [ ] **Step 5: Run the context-map checker**

Run: `cd /Users/levi/Development/dart-analytics && bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`

- [ ] **Step 6: Run the full app validation procedure**

Run: `cd app && npm run validate:app`
Expected: `db:status` → `db:migrate` → `db:introspect` → `npx fallow` → `npm test` (`Test Files 10 passed (10)`, `Tests 34 passed (34)`) → `astro check` (`0 errors, 0 warnings, 0 hints`) → `bash scripts/refresh-graph.sh` all pass (graph-refresh warns only if the `graphify` CLI isn't installed — record that warning if it happens).

- [ ] **Step 7: Stage the refreshed knowledge graph if changed**

```bash
cd /Users/levi/Development/dart-analytics
git status --short graphify-out/graph.json
```

If it shows as modified:

```bash
git add graphify-out/graph.json
git commit -m "chore(graph): refresh graph.json for test/variant convention change"
```

If nothing to stage, skip this commit.

- [ ] **Step 8: Commit the doc changes**

```bash
git add app/CLAUDE.md docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md DECISIONS.md docs/architecture/00-Context-Map.md
git commit -m "docs: enforce app/tests/ tree and inline variant logic (D101)"
```

- [ ] **Step 9: Confirm branch/PR status**

Per the root `CLAUDE.md` Context Maintenance protocol item 7: this work is on branch `test-and-variant-conventions`, branched from `login-implementation` (itself already on open PR #22). Push the branch and open a PR targeting `login-implementation` (not `main` directly, since this branch's diff only makes sense on top of the still-unmerged login/logout feature it was branched from):

```bash
git push -u origin test-and-variant-conventions
gh pr create --base login-implementation --title "Relocate tests to app/tests/, inline Button variant logic" --body "$(cat <<'EOF'
## Summary
- Moves every app/ Vitest test out of colocation into a mirrored app/tests/ tree
- Inlines Button.astro's variant map into its own frontmatter; deletes button-variants.ts and its test (accepted loss of coverage for that logic)
- Updates app/CLAUDE.md, 07-Frontend/10-Frontend-Agent-Guide.md, DECISIONS.md (D101), and 00-Context-Map.md to enforce the new conventions going forward

## Test plan
- [x] npm test passes (34 tests, 10 files, all under app/tests/)
- [x] astro check: 0 errors
- [x] scripts/check-context-map.sh passes
- [x] npm run validate:app passes end-to-end

Targets login-implementation (not main) since this branch depends on the still-unmerged login/logout feature (PR #22).
EOF
)"
```

Report the resulting PR link in the completion report.
