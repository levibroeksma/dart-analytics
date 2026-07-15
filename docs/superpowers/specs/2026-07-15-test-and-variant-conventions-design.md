# Test Tree & Variant Inlining Convention Change — Design

> **Date:** 2026-07-15
> **Status:** approved (brainstorming consensus)
> **Scope:** Relocate all `app/` Vitest tests from colocated `*.test.ts` to a mirrored `app/tests/` tree; inline `Button.astro`'s variant class map into its own frontmatter instead of a separate `button-variants.ts` helper. Update the canonical docs that mandate the old conventions so the new rules are enforced going forward.
> **Out of scope:** Any change to test *content* or assertions (pure relocation + import-path rewrite); any change to `Button.astro`'s rendered output or props; historical docs under `docs/superpowers/` (per `docs/CLAUDE.md`, these stay as point-in-time records and are never rewritten).

---

## Context

The project's existing, documented conventions are: (1) colocate every `*.test.ts` beside the module it tests (`app/CLAUDE.md`, `07-Frontend/10-Frontend-Agent-Guide.md`, tied to the mandatory-TDD decision D99), and (2) extract `.astro` variant/branching logic into a colocated `.ts` helper specifically so it stays unit-testable (`07-Frontend/10-Frontend-Agent-Guide.md`, `button-variants.ts` is the sole existing example). Both were deliberate, documented decisions with rationale — not accidental inconsistencies. The user has decided to reverse both:

1. Tests should live in a dedicated test tree, not beside source, matching more conventional test-tree layouts.
2. `Button.astro`'s variant map is trivial enough that a separate file for it is unwarranted; the resulting loss of Vitest coverage for that specific logic (there is no Astro-component test runner in this project) is an accepted trade-off, not a gap to solve around.

This is a repo-wide convention reversal, not a feature change — done on its own branch (`test-and-variant-conventions`, branched from `login-implementation` since `main` does not yet contain the affected code) per the project's task-per-branch rule.

---

## Design

### 1. Test tree relocation

`app/tests/` mirrors `app/src/` and `app/scripts/`, dropping the `src/` segment:

| Current | New |
| ------- | --- |
| `app/src/stores/auth.store.test.ts` | `app/tests/stores/auth.store.test.ts` |
| `app/src/pages/login/login.data.test.ts` | `app/tests/pages/login/login.data.test.ts` |
| `app/src/lib/client/api/client.test.ts` | `app/tests/lib/client/api/client.test.ts` |
| `app/src/lib/client/api/players.test.ts` | `app/tests/lib/client/api/players.test.ts` |
| `app/src/lib/client/cn.test.ts` | `app/tests/lib/client/cn.test.ts` |
| `app/src/types/api/players.test.ts` | `app/tests/types/api/players.test.ts` |
| `app/src/utils/auth-routes.test.ts` | `app/tests/utils/auth-routes.test.ts` |
| `app/src/utils/route-class.test.ts` | `app/tests/utils/route-class.test.ts` |
| `app/src/components/ui/logout.data.test.ts` | `app/tests/components/ui/logout.data.test.ts` |
| `app/scripts/seed-dev-auth.test.ts` | `app/tests/scripts/seed-dev-auth.test.ts` |

(`app/src/components/forms/button-variants.test.ts` is deleted, not relocated — see §2.)

`app/vitest.config.ts` changes:
- `test.include`: `['src/**/*.test.ts', 'scripts/**/*.test.ts']` → `['tests/**/*.test.ts']`
- `resolve.alias`: add `'@components': path.resolve(__dirname, './src/components')` (parity with `tsconfig.json`; needed because `logout.data.test.ts` imports from the same directory as `logout.data.ts`, which lives under `components/ui/`)

### 2. Import rewrites in relocated tests

Every relocated test currently imports its subject module via a same-directory relative path (`./auth.store`, `./cn`, etc.). Once moved out of that directory, these become alias imports using the aliases already defined in `tsconfig.json` (all but `@components` already exist in `vitest.config.ts`):

| Test | Old import | New import |
| ---- | ---------- | ---------- |
| `stores/auth.store.test.ts` | `./auth.store` | `@stores/auth.store` |
| `pages/login/login.data.test.ts` | `./login.data` | `@pages/login/login.data` |
| `lib/client/api/client.test.ts` | `./client` | `@client/api/client` |
| `lib/client/api/players.test.ts` | `./client`, `./players` | `@client/api/client`, `@client/api/players` |
| `lib/client/cn.test.ts` | `./cn` | `@client/cn` |
| `types/api/players.test.ts` | `./players` | `@types/api/players` |
| `utils/auth-routes.test.ts` | `./auth-routes` | `@utils/auth-routes` |
| `utils/route-class.test.ts` | `./route-class` | `@utils/route-class` |
| `components/ui/logout.data.test.ts` | `./logout.data` | `@components/ui/logout.data` |
| `scripts/seed-dev-auth.test.ts` | `./seed-dev-auth` | `../../scripts/seed-dev-auth` (no alias for `scripts/`; relative path is one level deeper than before: `tests/scripts/` → `app/scripts/`) |

All other imports in these files (already-aliased cross-cutting deps, `vitest` imports) are unchanged. Test *bodies* (assertions, mocks, `describe`/`it` blocks) are unchanged — this is a pure move + import-path fix.

### 3. Variant inlining

`Button.astro` currently:
```astro
// Lib
import { cn } from '@client/cn';
import { buttonVariantClass } from './button-variants';
...
const className = cn('btn', buttonVariantClass(variant), classNameProp);
```

Becomes (inlining `button-variants.ts`'s `VARIANT_CLASS` map directly):
```astro
// Lib
import { cn } from '@client/cn';
...
// Styles
const VARIANT_CLASS: Record<'primary' | 'secondary' | 'ghost', string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};
const className = cn('btn', VARIANT_CLASS[variant], classNameProp);
```

`app/src/components/forms/button-variants.ts` and `app/src/components/forms/button-variants.test.ts` are deleted. No replacement test exists for this logic — accepted, per the user's decision, since there is no Astro-component test runner in this project to exercise `.astro` frontmatter directly.

### 4. Documentation updates (canonical docs only)

- **`app/CLAUDE.md`**: replace "Colocate tests as `*.test.ts` beside the module under test (same folder)" with "Place tests under `app/tests/`, mirroring `app/src/`'s (and `app/scripts/`'s) directory structure — never colocated beside the module." Replace "`.astro` markup: extract testable class/variant maps to a colocated `.ts` helper when the component has branching logic" with "`.astro` markup: keep variant/branching logic inline in the component's own frontmatter; this logic is not unit-tested (no Astro-component test runner in this project) — do not extract a separate helper file solely to make it testable."
- **`07-Frontend/10-Frontend-Agent-Guide.md`**: same two rule changes (its TDD table + bullet list), and its Pre-Completion Checklist item referencing colocated tests updated to reference the `app/tests/` mirror.
- **`DECISIONS.md`**: new entry `D101` recording this reversal — of D99's colocation clause and the `button-variants.ts`-style extraction guidance from the Frontend Agent Guide — with rationale: mirrored test tree matches conventional test-layout expectations; inlined variant logic is simple enough that a dedicated testable helper isn't warranted, and the resulting untested status is an accepted, deliberate trade-off.
- **`00-Context-Map.md`**: update the "Frontend docs" and "Application code" rows in the Current Implementation State table with a dated note (2026-07-15) referencing the test-tree relocation and variant-inlining.

---

## Testing

This change touches test *location* and *imports*, not test *behavior*. Verification is: every relocated test still passes after its import is rewritten, `npm test` picks up all tests from the new `include` glob (and zero from the old locations, which no longer exist), and the full count of passing tests before and after matches minus the one deleted `button-variants.test.ts` (35 → 34).

---

## Context Maintenance

Per the root `CLAUDE.md` mandatory protocol: `00-Context-Map.md` gets a dated row update (no new files added/moved in the *docs* tree itself, so no inventory-table changes, just the implementation-state note); `DECISIONS.md` gets `D101`; `scripts/check-context-map.sh` must pass; `graphify-out/graph.json` refresh via `scripts/refresh-graph.sh` is required at completion, since `app/src/components/forms/button-variants.ts` is deleted and ~11 test files move (structural changes the graph should reflect).
