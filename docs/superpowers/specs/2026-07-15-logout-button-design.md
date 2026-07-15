# Logout Button — Design

> **Date:** 2026-07-15
> **Status:** approved (brainstorming consensus)
> **Scope:** `signOut()` on `auth.store.ts`, `logoutButton()` Alpine.data factory, `LogoutButton.astro` component, wired into the homepage (placeholder position).
> **Prerequisite:** Login page & client auth gate (`2026-07-15-login-page-design.md`, D98) — this is its sign-out counterpart.
> **Out of scope:** Final homepage placement, confirmation dialog, surfaced sign-out error messaging.

---

---

## Context

`auth.store.ts` and `login.data.ts` (D98) implement sign-in and the client auth gate, but there is no way to end a session from the UI today — `authClient.signOut()` (provided by `@neondatabase/auth`'s better-auth adapter) is unused. This spec adds a reusable logout control and wires it into the homepage, in a temporary position (final placement on the homepage is undecided and out of scope — the component must not be coupled to a specific layout position so it can be moved later without rework).

---

## Scope

In scope:
- `signOut()` method on `auth.store.ts`
- `logoutButton()` Alpine.data factory (`logout.data.ts`)
- `LogoutButton.astro` component wrapping `Button.astro`
- Wiring `<LogoutButton />` into `index.astro`'s existing content area
- Unit tests for the store method and the data factory (TDD, per `app/CLAUDE.md` / D99)

Out of scope:
- Final visual placement of the logout control (explicitly deferred by the user)
- A confirmation dialog before sign-out (decided against — no existing dialog primitive, immediate sign-out matches the app's current no-friction pattern)
- Surfacing a sign-out failure to the user (decided against — see Error Handling below)
- Any change to `middleware.ts` or route classification (`/` remains a protected prefix; logout is a client-side action, not a new route)

---

## Design

### `auth.store.ts` — add `signOut()`

```ts
async signOut() {
  await authClient.signOut();
  this.status = 'anonymous';
}
```

Mirrors the existing `signIn()` method: owns the `status` state transition, delegates the network call to `authClient`. Tested in `auth.store.test.ts` the same way `signIn` is tested today (mock `authClient.signOut`).

### `logout.data.ts` (new) — Alpine.data factory

```ts
import type { authStore } from '@stores/auth.store';

type AuthStore = ReturnType<typeof authStore>;

export function logoutButton() {
  return {
    loading: false,
    async submit(this: { loading: boolean; $store: { auth: Pick<AuthStore, 'signOut'> } }) {
      this.loading = true;
      await this.$store.auth.signOut();
      location.replace('/login');
    },
  };
}
```

Colocated `logout.data.test.ts` mocks `$store.auth.signOut` and asserts: `loading` becomes `true`, `signOut()` is called, `location.replace('/login')` is called after it resolves. Same test shape as `login.data.test.ts`.

### `LogoutButton.astro` (new)

Wraps `Button.astro` with `variant="secondary"`:

```astro
---
// Components
import Button from '@components/forms/Button.astro';
---

<button x-data="logoutButton()" @click="submit" :disabled="loading" class="btn btn-secondary">
  <span x-show="!loading">Sign out</span>
  <span x-show="loading">Signing out…</span>
</button>
```

(Exact markup — whether it wraps `Button.astro` directly or reimplements its class composition — is an implementation-plan detail; the constraint is: reuse `Button.astro`'s variant classes via `cn()`/`buttonVariantClass`, do not hand-roll new button styling.)

Follows `05-Astro-Components.md` frontmatter order (Props → imports → Data → Styles) and Alpine v3 shorthand rules (`@click`, `:disabled`, no `x-init`, `x-data()` invoked).

### Homepage wiring

`index.astro` renders `<LogoutButton />` inside the existing `<div class="p-4">` content block, next to the "Home" heading. This is a placeholder position — no layout changes to `AppLayout.astro` or `BottomNav.astro`.

---

## Error Handling

`signOut()` does not catch/surface errors — if the network call fails, the promise rejects and the `loading` flag would be left `true` with no user-facing message. This mirrors the existing posture of `hasActiveSession()` (which swallows errors and treats failure as "no session") rather than introducing a new error-surfacing pattern for this one action. If this proves confusing in practice, a follow-up can add an `error` field to `logoutButton()` matching `loginForm()`'s pattern — deferred, not decided against permanently.

---

## Testing

Per `app/CLAUDE.md` TDD mandate (D99): write failing tests first for `auth.store.ts`'s `signOut()` and `logout.data.ts`'s `submit()`, then implement. No live Neon calls — mock `@client/auth`.

---

## Context Maintenance

This is an additive frontend change with no new route, no schema change, and no new architectural pattern — no `00-Context-Map.md`, `07-Frontend/*`, or `app/CLAUDE.md` edits are required. `graphify-out/graph.json` refresh (`scripts/refresh-graph.sh`) is still required at completion per the standard gate.
