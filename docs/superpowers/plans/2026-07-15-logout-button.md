# Logout Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working sign-out control to the app: a `signOut()` method on the auth store, a reusable `LogoutButton` UI component backed by an Alpine.data factory, and its placeholder wiring into the homepage.

**Architecture:** Mirrors the existing sign-in flow exactly. `auth.store.ts` gains a `signOut()` method (parallel to `signIn()`) that calls `authClient.signOut()` and flips `status` to `'anonymous'`. A new `logoutButton()` Alpine.data factory (parallel to `loginForm()`) owns the click-to-redirect behavior and is registered as portable UI data (not route data, since it isn't tied to one page). `LogoutButton.astro` wraps the existing `Button.astro` (`variant="secondary"`) and wires the Alpine directives through `Button.astro`'s existing `{...rest}` prop forwarding — no changes needed to `Button.astro` itself.

**Tech Stack:** Astro, TypeScript, Alpine.js v3 (shorthand directives), Vitest.

## Global Constraints

- TDD mandatory: red → green for every behavior change (`app/CLAUDE.md`, D99). Write the failing test before the implementation in every task below.
- Alpine v3 shorthand only: `@click`, `:disabled` — never `x-bind:*`/`x-on:*`; `x-data="factory()"` always invoked; no `x-init`.
- `.astro` frontmatter order: `interface Props` → `// Props` destructure → imports (`// Layouts`/`// Components`/`// Icons`/`// Lib`) → `// Data` → `// Styles`.
- `$persist` is not used here (out of scope — no persisted state in this feature).
- No confirmation dialog before sign-out; sign-out is immediate (spec decision).
- No error surfacing on `signOut()` failure — mirrors `hasActiveSession()`'s swallow-and-treat-as-anonymous posture (spec decision, `docs/superpowers/specs/2026-07-15-logout-button-design.md`).
- Redirect via `location.replace('/login')`, not `location.href`.
- Final homepage placement of the button is explicitly deferred — wire it into the existing `<div class="p-4">` content block in `index.astro` as a placeholder; do not touch `AppLayout.astro` or `BottomNav.astro`.
- Run `npm test` after every task; all tests must stay green.

---

## File Structure

- Modify: `app/src/stores/auth.store.ts` — add `signOut()`.
- Modify: `app/src/stores/auth.store.test.ts` — add `signOut` test cases.
- Create: `app/src/components/ui/logout.data.ts` — `logoutButton()` Alpine.data factory (portable UI data, colocated with the component that uses it, matching how `button-variants.ts` sits beside `Button.astro`).
- Create: `app/src/components/ui/logout.data.test.ts` — unit tests for `logoutButton()`.
- Create: `app/src/components/ui/LogoutButton.astro` — wraps `Button.astro`, wires `x-data="logoutButton()"`.
- Modify: `app/src/lib/client/alpine/register-ui-data.ts` — register `logoutButton` (this is the existing, currently-empty hook for component-scoped Alpine.data factories — see `register-route-data.ts` for the page-scoped equivalent already used by `loginForm`).
- Modify: `app/src/pages/index.astro` — render `<LogoutButton />` in the existing content block.

---

### Task 1: `signOut()` on `auth.store.ts`

**Files:**
- Modify: `app/src/stores/auth.store.ts`
- Test: `app/src/stores/auth.store.test.ts`

**Interfaces:**
- Consumes: `authClient.signOut(): Promise<unknown>` (already exists on `@client/auth/client`'s `authClient`, unused until now — confirmed present in `@neondatabase/auth`'s better-auth adapter).
- Produces: `authStore().signOut(): Promise<void>` — sets `this.status = 'anonymous'` after `authClient.signOut()` resolves. Later tasks (`logoutButton()`) call `this.$store.auth.signOut()` and depend on this exact method name and zero-argument signature.

- [ ] **Step 1: Write the failing test**

Add to `app/src/stores/auth.store.test.ts`, inside a new `describe('authStore.signOut', ...)` block (after the existing `authStore.signIn` block). First extend the top-of-file mock to include `signOut`:

```ts
vi.mock('@client/auth/client', () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  },
}));
```

Then add:

```ts
describe('authStore.signOut', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets anonymous after signOut resolves', async () => {
    vi.mocked(authClient.signOut).mockResolvedValue(undefined);
    const store = authStore();
    store.status = 'authenticated';
    await store.signOut();
    expect(authClient.signOut).toHaveBeenCalled();
    expect(store.status).toBe('anonymous');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/stores/auth.store.test.ts`
Expected: FAIL — `store.signOut is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `app/src/stores/auth.store.ts`, add the method to the object returned by `authStore()`, after `signIn`:

```ts
    async signOut() {
      await authClient.signOut();
      this.status = 'anonymous';
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/stores/auth.store.test.ts`
Expected: PASS — all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add app/src/stores/auth.store.ts app/src/stores/auth.store.test.ts
git commit -m "feat(app): add signOut to auth store"
```

---

### Task 2: `logoutButton()` Alpine.data factory

**Files:**
- Create: `app/src/components/ui/logout.data.ts`
- Test: `app/src/components/ui/logout.data.test.ts`

**Interfaces:**
- Consumes: `authStore().signOut(): Promise<void>` (Task 1) via `this.$store.auth.signOut()`.
- Produces: `logoutButton(): { loading: boolean; submit(): Promise<void> }` — the Alpine.data factory. Task 3 (`LogoutButton.astro`) wires `x-data="logoutButton()"`, `@click="submit"`, `:disabled="loading"`. Task 4 (`register-ui-data.ts`) imports `logoutButton` by this exact name from `@components/ui/logout.data`.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/logout.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logoutButton, type LogoutButtonContext } from './logout.data';

describe('logoutButton.submit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sets loading, calls signOut, then redirects to /login', async () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { replace });

    const signOut = vi.fn().mockResolvedValue(undefined);
    const button = logoutButton();
    (button as unknown as LogoutButtonContext).$store = {
      auth: { signOut },
    };

    const submitPromise = (button as unknown as LogoutButtonContext).submit();
    expect(button.loading).toBe(true);
    await submitPromise;

    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/login');

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/components/ui/logout.data.test.ts`
Expected: FAIL — cannot find module `./logout.data`.

- [ ] **Step 3: Write minimal implementation**

Create `app/src/components/ui/logout.data.ts`:

```ts
import type { authStore } from '@stores/auth.store';

type AuthStore = ReturnType<typeof authStore>;

export type LogoutButtonContext = {
  loading: boolean;
  $store: { auth: Pick<AuthStore, 'signOut'> };
  submit(): Promise<void>;
};

export function logoutButton() {
  return {
    loading: false,

    async submit(this: LogoutButtonContext) {
      this.loading = true;
      await this.$store.auth.signOut();
      location.replace('/login');
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/components/ui/logout.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ui/logout.data.ts app/src/components/ui/logout.data.test.ts
git commit -m "feat(app): add logoutButton Alpine.data factory"
```

---

### Task 3: `LogoutButton.astro` component

**Files:**
- Create: `app/src/components/ui/LogoutButton.astro`

**Interfaces:**
- Consumes: `Button.astro`'s `Props` (`variant`, `type`, `class`, `[key: string]: unknown` passthrough via `{...rest}` — confirmed in `app/src/components/forms/Button.astro:2-15`); `logoutButton()` from Task 2 by name (referenced as an Alpine expression string, not a TS import — Alpine resolves registered data factories by the string name at runtime).
- Produces: `<LogoutButton />` — a zero-prop component. Task 5 (`index.astro`) imports and renders it via `@components/ui/LogoutButton.astro`.

This component has no branching logic, so per the Frontend Agent Guide TDD rule ("`.astro` components with variant/branching logic: extract a colocated `.ts` helper and test that helper") no colocated test file is required — the only logic (`submit`, `loading`) already lives in and is tested by `logout.data.ts` (Task 2).

- [ ] **Step 1: Write the component**

Create `app/src/components/ui/LogoutButton.astro`:

```astro
---
// Components
import Button from '@components/forms/Button.astro';
---

<Button
  type="button"
  variant="secondary"
  x-data="logoutButton()"
  @click="submit"
  :disabled="loading"
>
  <span x-show="!loading">Sign out</span>
  <span x-show="loading">Signing out…</span>
</Button>
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `cd app && npm test`
Expected: PASS — this step adds no new tests (see rationale above), so this confirms the new file doesn't break existing ones (e.g. via a typo caught by `astro check` later in Task 6).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ui/LogoutButton.astro
git commit -m "feat(app): add LogoutButton component"
```

---

### Task 4: Register `logoutButton` as UI data

**Files:**
- Modify: `app/src/lib/client/alpine/register-ui-data.ts`

**Interfaces:**
- Consumes: `logoutButton` from `@components/ui/logout.data` (Task 2).
- Produces: Alpine data name `'logoutButton'` registered globally, resolvable by the `x-data="logoutButton()"` string in `LogoutButton.astro` (Task 3).

- [ ] **Step 1: Update the registration function**

Replace the contents of `app/src/lib/client/alpine/register-ui-data.ts`:

```ts
import type { Alpine } from 'alpinejs';
import { logoutButton } from '@components/ui/logout.data';

export function registerUiData(Alpine: Alpine) {
  Alpine.data('logoutButton', logoutButton);
}
```

- [ ] **Step 2: Run the full test suite**

Run: `cd app && npm test`
Expected: PASS — no existing test covers `register-ui-data.ts` directly (it has no branching logic, matching the existing untested `register-route-data.ts` and `register-stores.ts`), so this step confirms nothing else broke.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/client/alpine/register-ui-data.ts
git commit -m "feat(app): register logoutButton Alpine data"
```

---

### Task 5: Wire `LogoutButton` into the homepage

**Files:**
- Modify: `app/src/pages/index.astro`

**Interfaces:**
- Consumes: `LogoutButton` from `@components/ui/LogoutButton.astro` (Task 3).

- [ ] **Step 1: Update the page**

Replace `app/src/pages/index.astro` in full:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import LogoutButton from "@components/ui/LogoutButton.astro";
---

<AppLayout title="Home">
  <div class="p-4">
    <h1 class="text-xl font-semibold text-fg">Home</h1>
    <LogoutButton />
  </div>
</AppLayout>
```

This is a placeholder position inside the existing content block per the spec (final placement is explicitly deferred).

- [ ] **Step 2: Run the full test suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/index.astro
git commit -m "feat(app): render LogoutButton on the homepage"
```

---

### Task 6: Full validation and completion gate

**Files:** none (verification only).

- [ ] **Step 1: Run the full app validation procedure**

Run: `cd app && npm run validate:app`
Expected: `db:status` → `db:migrate` → `db:introspect` → `npx fallow` → `npm test` → `astro check` → `bash scripts/refresh-graph.sh` all pass (or the graph-refresh step warns only if the `graphify` CLI isn't installed in this environment — record that warning if it happens, per `app/CLAUDE.md`).

- [ ] **Step 2: Run the context-map checker**

Run: `bash scripts/check-context-map.sh` (from repo root)
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.` This feature adds no new docs and no new architectural pattern (per the spec's Context Maintenance section), so no `00-Context-Map.md` edit is expected — this step just confirms that holds.

- [ ] **Step 3: Manually verify in a running dev server**

Run: `astro dev --background` (per `app/CLAUDE.md`), then in a browser: sign in at `/login`, land on `/`, confirm the "Sign out" button renders, click it, confirm redirect to `/login`, and confirm `authClient.getSession()` no longer reports a session (i.e. navigating back to `/` redirects to `/login` again per the existing client auth gate).

- [ ] **Step 4: Stage the refreshed knowledge graph if changed**

```bash
git status --short graphify-out/graph.json
```

If it shows as modified, stage it:

```bash
git add graphify-out/graph.json
git commit -m "chore(graph): refresh graph.json for logout button"
```

If nothing to stage, skip this commit.

- [ ] **Step 5: Confirm branch/PR status**

Per the root `CLAUDE.md` Context Maintenance protocol item 7: confirm this work is on `main` or an open PR targets `main`, and report the PR link (or reason none exists) in the completion report. This branch (`login-implementation`) already has commits ahead of `main`; note in the completion report whether a PR should be opened now or as part of a later, separate integration step.
