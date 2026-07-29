# Design — Bottom Nav Active Status on Nested Routes (issue #51)

> Status: proposed design (point-in-time task spec; non-canonical).
> Date: 2026-07-29.
> Scope: fix the bottom nav's active-item highlighting so it stays applied on nested routes (e.g. Score Training's setup/play pages), not just exact top-level matches.
> Relates to: GitHub issue [#51](https://github.com/levibroeksma/dart-analytics/issues/51).

---

## 1. Background & Motivation

Issue #51: "The active page status for nav items only works on homepage." User's framing: for Games specifically, nested pages (game setup/play sub-routes) should still apply the active status to the bottom nav item.

Root cause found in `app/src/components/layout/NavBtn.astro:17`:

```ts
const active = isNavActive(Astro.url.pathname, href, matchPrefix);
```

`app/src/components/layout/BottomNav.astro`'s `pages` array (Home `/`, Games `/games`, Stats `/statistics`, Profile `/profile`) never passes `matchPrefix` to any `<NavBtn>`. `isNavActive()` (`app/src/lib/utils/is-nav-active.ts`) therefore falls back to exact `pathname === href` matching for every item. Home's href is `/`, which can only ever be reached exactly, so it happens to work by construction — this is why the bug reads as "only works on homepage." Games' href is `/games`; the moment the pathname is `/games/score-training/setup` or `/games/score-training/play`, the exact match fails and the Games nav item loses its active styling and `aria-current="page"`.

`is-nav-active.ts` and `NavBtn.astro`'s active-computation have zero test coverage today.

---

## 2. Decisions (brainstorming)

| Topic | Choice |
| ----- | ------ |
| Fix scope | General: every non-root nav item auto-derives a prefix match, not just a targeted `matchPrefix="/games"` passed from `BottomNav.astro` — protects Stats/Profile if they gain nested routes later without anyone needing to remember to wire it |
| Fix location | `NavBtn.astro`, not `BottomNav.astro` or `isNavActive()` — the "auto-derive a sensible default from href" policy is nav-UI-specific, so `isNavActive()` stays a small, pure, explicit matcher and `BottomNav.astro` needs no changes at all |
| Auto-derived prefix shape | `${href}/` (trailing slash), not bare `href` — requires a real path separator so a hypothetical route sharing a prefix string (e.g. `/games-archive`) can never falsely match `/games`'s prefix; the exact-match branch in `isNavActive()` already covers the bare `/games` case |
| Root href (`/`) | Stays exact-match only, never auto-prefixed — a prefix of `/` would match every route on the site |
| Explicit `matchPrefix` prop | Still overrides the auto-derived default when passed — no behavior change for a hypothetical future caller wanting something custom |

---

## 3. Scope

**In:**

- `app/src/components/layout/NavBtn.astro` — compute an auto-derived `matchPrefix` default before calling `isNavActive()`.
- New test file: `app/tests/utils/is-nav-active.test.ts` (this repo's established convention: `@utils/*` source files under `app/src/lib/utils/` get tests directly under `app/tests/utils/`, not `app/tests/lib/utils/` — confirmed against `auth-routes.test.ts` and `route-class.test.ts`, both already following this pattern).

**Out:**

- `app/src/lib/utils/is-nav-active.ts` — no change; stays a pure, explicit matcher.
- `app/src/components/layout/BottomNav.astro` — no change; the general fix means it never needs to pass `matchPrefix` manually, for Games or any future nested section.
- `.astro` component-level testing — `NavBtn.astro`'s rendered output isn't unit-tested (no Astro component test runner in this repo, D101); the fix is verified via `is-nav-active.test.ts` (the logic) plus a manual dev-server check (the rendering).

---

## 4. `NavBtn.astro` change

Find:

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

No other line in the file changes — `className`, the `<a>` element, `aria-current` all consume `active` exactly as before.

---

## 5. Testing

New file `app/tests/utils/is-nav-active.test.ts`, covering:

- Exact match still works (`pathname === href` → `true`), matching existing behavior.
- No match when pathname is unrelated and no prefix is given.
- Explicit `matchPrefix` still matches a nested path (regression guard for the existing, already-correct parameter).
- The two edge cases this design specifically depends on: a prefix of `/` must NOT match an unrelated path (guards against ever accidentally auto-deriving a root prefix), and a prefix string that is a literal substring of another route (e.g. `/games` vs. `/games-archive`) must NOT falsely match without the trailing-slash requirement.

`NavBtn.astro`'s own logic change (the `effectiveMatchPrefix` computation) is one line calling already-tested `isNavActive()` — verified by running the dev server and checking the Games nav item stays highlighted on `/games/score-training/setup` and `/games/score-training/play`, not by a new component test.

---

## 6. Success criteria

- Visiting `/games/score-training/setup` or `/games/score-training/play` shows the Games bottom-nav item highlighted (`text-accent`, `aria-current="page"`), not the default unhighlighted state.
- Visiting `/` still highlights only Home, never Games/Stats/Profile.
- `cd app && npm test` passes with the new test file.
- `npm run check` reports 0 errors.
