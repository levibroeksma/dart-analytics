# Frontend Conventions Hardening — Design

> **Date:** 2026-07-16
> **Status:** approved (brainstorming consensus)
> **Scope:** Five related hardenings surfaced by the auth-file-reorg work (`refactor/organize-auth-data-files`), folded into the same branch/PR: (1) universal type/interface barrel-raising — `type` aliases and `interface` declarations each raised through their own separate barrel chain (`types.ts` / `interfaces.ts`), including relocating API contract types out of a top-level `types/` tree into the domain folders that own them, excluding `.astro` frontmatter and `env.d.ts`; (2) a new frontend test-strategy doc plus a shared-mocks convention; (3) a zero-exception rule that no `.ts` file lives directly under `components/` or `pages/` except `pages/api/**`, with mechanical enforcement; (4) centralized client-side error-message mapping keyed by the shared `ErrorCode` type; (5) a self-learning gate added to the root Context Maintenance protocol so rule sharpenings are proposed and approved before being written, not applied unilaterally.
> **Out of scope:** Any change to `Button.astro`/variant conventions or test-tree layout (settled in `2026-07-15-test-and-variant-conventions-design.md`); gameplay/session domain work; renaming `components/ui/LogoutButton.astro` or any other component-domain reorganization; adding `@repositories`/`@db`/`@services` support for anything beyond fixing the concrete deep-relative-import violations found during this sweep.

---

## Context

The auth-reorg session (moving `login.data.ts`/`logout.data.ts` into `lib/auth/`) surfaced that the codebase's own documented conventions were already being violated in several places once actually grepped for:

- `lib/client/api/players.ts` imports contract types via a 3-level deep relative path instead of an alias.
- `pages/api/players/provision.ts` **re-declares its own local copy** of the `ProvisionPlayerRequest` Zod schema instead of importing the canonical one — the exact DTO drift D87 was meant to prevent, already happening.
- `services/player.service.ts`, `repositories/player.repository.ts`, `db/client.ts`, `lib/auth/verify-jwt.ts` all use relative parent-directory imports (`../db/client`, `../repositories/player.repository`, `../lib/id`, `../env`) despite `@lib`, and the "documented target" `@services`/`@repositories`/`@db` aliases from `06-API/02-Middleware-And-Layering.md` never having been added even though those folders are now populated.
- `repositories/player.repository.ts` defines `export interface ProvisionedPlayer` inline and `services/player.service.ts` imports it via a deep, mixed (runtime + type) relative import — an interface consumed outside its defining file with nowhere established to raise it to.
- `authClient` is mocked twice, with two different (inconsistent) shapes, in `auth.store.test.ts` and `login.data.test.ts`.
- Error-message mapping (`mapSignInError`, `mapProvisionError`) is local to `login.data.ts` — not reusable, and conflates two genuinely different error surfaces (our own API's code registry vs. the third-party Neon Auth SDK's message-only errors).
- Nothing stops a future `.ts` file from landing back in `components/` or `pages/` beside its `.astro` file — the only reason today's tree is clean is discipline, not enforcement.

None of this is a single bug; it's a pattern of documented-but-unenforced conventions drifting the moment nobody is looking. Item 5 exists because this same drift will keep happening to whatever rules come out of this design unless sharpening them is a deliberate, gated step every task passes through — not an afterthought.

---

## Design

### 1. Universal type/interface barrel-raising + contract-type relocation

**Placement change:** contract types move out of a root-level `types/` tree into the domain folder that owns them, matching the *already-documented but unrealized* target structure in `02-Middleware-And-Layering.md` (`pages/api/sessions/types.ts # domain contract barrel (@routes/... via alias)`).

| Current | New |
| ------- | --- |
| `app/src/types/api/players.ts` | `app/src/pages/api/players/types.ts` |
| `app/src/types/api/index.ts` | `app/src/pages/api/types.ts` (routes-area barrel: `export * from './players/types'`) |

**Barrel filename standardized on `types.ts` everywhere** — it's documented ~15 times across `03-Shared-Conventions.md` and `02-Middleware-And-Layering.md` (`services/types.ts`, `repositories/types.ts`, `routes/types.ts`, `lib/types.ts`) versus only 2 real `index.ts` files in the codebase today, and is more explicit/purpose-revealing, matching this project's existing suffix-convention preference. No bare `@client` or `@client/api` imports exist anywhere (verified), so these renames are risk-free:

| Rename | Consumer fix |
| ------ | ------------ |
| `lib/client/api/index.ts` → `lib/client/api/types.ts` | `client.ts`'s `import type {...} from '.'` → `from './types'` |
| `lib/client/index.ts` → `lib/client/types.ts` | none |

**Two barrels, not one — Worker-side and client-owned.** `04-Modules-And-OOP.md` already documents that `modules/game/*.payload.module.ts` files import DTO types from (currently) `@types/api` and never call `@client/api`. Browser code (modules, forms, future `.data.ts` files) must therefore never import directly from `@routes/types` (a Worker route folder) even though it's type-only — it imports through a client-owned barrel instead:

- `lib/client/api/types.ts` becomes that barrel: alongside its existing envelope types (`ApiErrorBody`, `ApiResult`, etc.) it re-exports the domain DTOs it needs, e.g. `export type { ProvisionPlayerRequestInput, ProvisionPlayerResponseData } from '@routes/types';`.
- `lib/client/api/players.ts` imports from the sibling `./types` (relative, same folder), not `@routes/types` directly.
- Any future `modules/`/`forms/` code imports domain DTOs from `@client/api/types` — the direct successor to `@types/api`. `04-Modules-And-OOP.md`'s "`@types/api` only" line is updated to `@client/api/types`.
- `lib/client/api/types.ts` is the **only** file in the browser tree with a legitimate `@routes/types` import — it's the deliberate Worker↔browser bridge point, re-raising into `@client/api/types` for everything else to consume.

**`ErrorCode` cross-cutting type** (needed by §4): stays *defined* in `lib/server/errors.ts` (Worker-authoritative — HTTP status/retryable/technical-message are colocated with it), re-exported type-only through `pages/api/types.ts` → `@routes/types`, then re-raised again through `lib/client/api/types.ts` → `@client/api/types` following the same two-barrel rule above. `lib/client/errors.ts` (§4) imports `ErrorCode` from `@client/api/types`. Every hop is type-only and erases at build, so there's no runtime coupling and no violation of "browser must not import `lib/server/`."

**Alias set additions** (`app/tsconfig.json` + `app/vitest.config.ts`, kept in sync as today):

```diff
+ "@services/*": ["./src/services/*"],
+ "@repositories/*": ["./src/repositories/*"],
+ "@db/*": ["./src/db/*"],
+ "@routes/*": ["./src/pages/api/*"],
- "@types/*": ["./src/types/*"],
```

(`@lib/*`, `@server/*` already exist and are reused, not added.)

**Full fix list** (every deep/parent-relative import found in `app/src` during the sweep, one deliberate exception noted):

| File | Before | After |
| ---- | ------ | ----- |
| `pages/api/players/provision.ts` | local `ProvisionPlayerRequest` redeclaration | `import { ProvisionPlayerRequest } from './types'` |
| `pages/api/players/provision.ts` | `../../../services/player.service` | `@services/player.service` |
| `pages/api/players/provision.ts` | `../../../lib/server/envelope` | `@server/envelope` |
| `lib/client/api/players.ts` | `../../../types/api/players` | `./types` (re-exported from `@routes/types`) |
| `services/player.service.ts` | `../db/client` | `@db/client` |
| `services/player.service.ts` | `../lib/id` | `@lib/id` |
| `services/player.service.ts` | `../repositories/player.repository` | `@repositories/player.repository` |
| `repositories/player.repository.ts` | `../db/schema`, `../db/client` | `@db/schema`, `@db/client` |
| `db/client.ts` | `../lib/env` | `@lib/env` |
| `lib/auth/verify-jwt.ts` | `../env` | `@lib/env` |
| `tests/types/api/players.test.ts` | moves to `tests/pages/api/players/types.test.ts`; `../../../src/types/api/players` | `@routes/types` (Worker-side test, the one legitimate direct import alongside `players.ts`) |

**Deliberate exception:** `lib/env.ts`'s `import config from "../../neon"` targets `app/neon.ts`, which lives *outside* `src/` entirely — no `@`-alias maps outside `src/`, and this is a different kind of boundary (app-root config, not intra-`src` module layering) than the raising rule addresses. Left unchanged.

**Raising scope rule** (resolves the "which types count" question): a type is raised into a barrel **only once it's consumed outside the file that defines it**. `LoginFormContext`/`LogoutButtonContext` stay inline in their own `.data.ts` files — each is used only by its defining file and that file's own test importing it directly; there's nothing to raise.

**Interface raising — a parallel, separate chain.** TS `interface` declarations follow the identical raising mechanics as `type` aliases (same folder-by-folder barrel chain, same "raised only once consumed outside its defining file" scope rule), but through their **own** `interfaces.ts` barrel file, never mixed into `types.ts`. A folder that has both shared types and shared interfaces gets two barrels side by side (`types.ts` + `interfaces.ts`), each raised independently up its own chain — keeping the two vocabularies (structural `type` aliases/unions vs. `interface` contracts) separable at a glance rather than interleaved in one file.

Two exceptions, both already-established conventions this rule doesn't touch:
- **`.astro` component interfaces** (e.g. `interface Props`) stay inline in the component's own frontmatter — never raised, per the existing D92 authoring convention (`05-Astro-Components.md`).
- **`env.d.ts`** (`interface AppLocalsAuth`, `declare namespace App`) is a TypeScript ambient global-augmentation file at an Astro/TS-required well-known path, not a regular module — excluded from the raising system entirely, the same way `lib/env.ts`'s `../../neon` import is excluded from the relative-import rule above.

**Concrete fix found:** `repositories/player.repository.ts` defines `export interface ProvisionedPlayer` inline and `services/player.service.ts` imports it via a deep mixed import (`import { upsertPlayerByAuthUserId, type ProvisionedPlayer } from "../repositories/player.repository"`) — consumed outside its defining file, so it qualifies for raising:

| File | Before | After |
| ---- | ------ | ----- |
| `repositories/player.repository.ts` | `export interface ProvisionedPlayer {...}` defined inline | interface moves to new `repositories/interfaces.ts`; repository imports it back via `./interfaces` |
| `services/player.service.ts` | `import { upsertPlayerByAuthUserId, type ProvisionedPlayer } from "../repositories/player.repository"` | `import { upsertPlayerByAuthUserId } from '@repositories/player.repository'; import type { ProvisionedPlayer } from '@repositories/interfaces';` |

`repositories/interfaces.ts` is the area-root barrel for repository-layer interfaces (mirrors how `services/types.ts` is described as a "top-level area barrel" in `03-Shared-Conventions.md`); `services/player.service.ts` reaches it directly via the `@repositories` alias since `services/` and `repositories/` are sibling top-level areas, not nested under a shared parent.

**Doc updates:**
- `06-API/03-Shared-Conventions.md`'s barrel-raising section reworded from Worker-only framing to universal (Worker + browser, Zod-derived + hand-authored), citing `pages/api/players/types.ts` and `lib/client/api/types.ts` as the two reference examples, stating the two-barrel (Worker barrel + client-owned re-raising barrel) rule explicitly, and adding the parallel `interfaces.ts` chain (same mechanics, separate file, `repositories/interfaces.ts` as the reference example) plus its two exceptions (`.astro` frontmatter, `env.d.ts`).
- `04-Modules-And-OOP.md`: "Payload modules import types from `@types/api` only" → "from `@client/api/types` only."
- `02-Folder-Structure.md`: Path Aliases table and Import Direction diagram updated for the new alias set (§ alias diff above) and the `@types/api` → `@client/api/types` successor.

### 2. Test strategy documentation

**New doc:** `docs/architecture/07-Frontend/06-Test-Strategy.md` (numbered after `05-Astro-Components.md`, before `10-Frontend-Agent-Guide.md`), covering:

1. **TDD is mandatory** — cross-references D99/`app/CLAUDE.md`'s red→green→refactor procedure (stays the sole command definition; this doc adds rationale and edge cases only).
2. **Shared mocks:** `app/tests/mocks/<name>.mock.ts` exports a factory (e.g. `createAuthClientMock()`), wired once via a new `app/tests/setup.ts` registered in `vitest.config.ts`'s `setupFiles`. Individual tests override return values per-case with `vi.mocked(x).mockResolvedValue(...)` in their own `beforeEach` — unchanged from today's per-test pattern, just without re-declaring the mock's shape per file. Threshold for promoting a mock into `tests/mocks/`: **2+ test files mocking the same module** (mirrors the `.data.ts` colocation-promotion threshold already documented). First case: `authClient`, currently duplicated with inconsistent shapes in `auth.store.test.ts` and `login.data.test.ts`; `players.test.ts`'s single-use `apiRequest` mock stays local.
3. **Full-suite-always-runs policy:** `npm test` runs the complete suite (never `--bail`, never scoped to touched files) before any task is claimed done. Pre-existing/out-of-scope failures are never silently dropped — they're named explicitly in the completion report — but don't block completion unless the current change caused them.

**Also updated:**
- `app/CLAUDE.md` TDD section: cross-reference to the new doc, one-line mention of the shared-mocks and full-suite policy.
- `07-Frontend/10-Frontend-Agent-Guide.md` §11 (Test-driven development): same cross-reference.
- `auth.store.test.ts` + `login.data.test.ts`: migrate off local `vi.mock('@client/auth/client', ...)` blocks onto the shared `tests/mocks/auth-client.mock.ts` + global setup.
- `00-Context-Map.md`: register the new doc in the File Inventory table; add a context-pack row for "new test / test-strategy question."

### 3. No `.ts` outside `components/`, `pages/` (except `pages/api/**`)

**Rule:** zero exceptions — no `.ts` file ever lives directly under `components/` or `pages/` (except `pages/api/**`), regardless of single- or multi-consumer use. `lib/<domain>/` is always the answer, where `<domain>` uses the same vocabulary as `modules/<domain>/` and `stores/<domain>.store.ts` (e.g. `auth`, future `game`, `players`) — never a route or component-folder name. (`lib/auth/` already satisfies this.)

This reverses part of last session's "Colocation vs Promotion" table in `02-Folder-Structure.md`, which allowed single-route `.data.ts` files to colocate under `pages/<route>/`:

| Scope (revised) | Location |
| ---------------- | -------- |
| Any `.ts` logic used by a page/component | `lib/<domain>/` — always, even single-route |
| Used by 2+ routes, warrants store/form/module semantics | `stores/`, `forms/`, `modules/` |

- Remove the `└── <route>.data.ts # optional colocated Alpine.data factory` line from the Authoritative Tree diagram in `02-Folder-Structure.md`.
- `10-Frontend-Agent-Guide.md` Forbidden list: add the zero-exception rule.
- `app/CLAUDE.md`'s TypeScript file organization section: state the exclusion explicitly.

**Mechanical enforcement** — new `scripts/check-file-locations.sh`:

```bash
#!/usr/bin/env bash
# File-location gate (docs/architecture/07-Frontend/02-Folder-Structure.md):
# no .ts files directly under components/ or pages/, except pages/api/**.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

VIOLATIONS=$(find app/src/components app/src/pages -name "*.ts" 2>/dev/null | grep -v '^app/src/pages/api/')
if [ -n "$VIOLATIONS" ]; then
  echo "FAIL: .ts files found outside lib/ (must live under app/src/lib/<domain>/):" >&2
  echo "$VIOLATIONS" >&2
  exit 1
fi
echo "OK: no stray .ts files under components/ or pages/ (excluding pages/api/)."
```

Wired in two places (mirrors `check-context-map.sh`'s dual placement exactly):
- Root `CLAUDE.md` Context Maintenance step 5: run alongside `check-context-map.sh`.
- `.github/workflows/checks.yml`: rename the `context-map` job to `structure`, add a second step calling the new script. Fast, dependency-free, runs on every PR to `main` alongside the existing job.

### 4. Centralized client-side error-message mapping

Two distinct error surfaces exist and must not be conflated:

1. **Our own API errors** (`ApiFailure.error.code`) — finite, registry-backed (`06-API/03-Shared-Conventions.md`, closed for v1). `ProvisionError` carries one of these codes.
2. **Neon Auth SDK errors** (`authClient.signIn.email` failures) — third-party surface, no domain code, message-only. `mapSignInError`'s regex heuristic exists precisely because this surface has no registry to key off.

**New file:** `app/src/lib/client/errors.ts`

```typescript
import type { ErrorCode } from '@client/api/types';
import { ProvisionError } from './api/players';

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHORIZED: 'Email or password is incorrect.',
  PLAYER_NOT_PROVISIONED: 'Account setup failed. Contact support.',
};
const FALLBACK = 'Could not reach the server. Try again.';

export function getErrorMessage(err: unknown): string {
  if (err instanceof ProvisionError) {
    return (MESSAGES as Record<string, string>)[err.code] ?? err.message;
  }
  if (err instanceof Error && /invalid|credential/i.test(err.message)) {
    return MESSAGES.UNAUTHORIZED!;
  }
  return FALLBACK;
}
```

`Partial<Record<ErrorCode, string>>` — not a full `Record` — so it's typo/rename-safe against the shared `ErrorCode` union without forcing speculative UX copy for gameplay codes with no UI yet (`SESSION_ALREADY_COMPLETED`, etc.); it grows as real UI consumes each code.

- `login.data.ts`: delete `mapSignInError`/`mapProvisionError`; the catch block collapses to `this.error = getErrorMessage(err);` for both branches.
- `auth.store.ts`: **unchanged** — correctly stays a thin pass-through of the raw SDK error; UX-copy mapping is the client error module's job, not the store's.
- `07-Frontend/00-Overview.md`'s "Client wrapper responsibilities" table: its existing "Map domain codes to UI messages | Optional helper | Yes" row is updated to name `lib/client/errors.ts` as the mandatory, single mechanism — no longer ad hoc per-page.

**Tests:** `mapSignInError`/`mapProvisionError` tests move out of `login.data.test.ts` into a new `tests/lib/client/errors.test.ts`; `login.data.test.ts` keeps only its `submit()` integration tests (assertions unchanged, now exercising the centralized path).

### 5. Self-learning gate

**Placement:** new step 8 in root `CLAUDE.md`'s "Context Maintenance (mandatory, every task)" protocol, mirrored to `AGENT.md` per the existing mirror rule. Distinct from step 1 (mechanical: update a `CLAUDE.md` when your own code change alters a rule it documents) — step 8 covers gaps a task *surfaces* beyond its explicit scope.

> 8. **Self-learning gate:** if this task surfaced a rule that was ambiguous, missing, unenforced, or contradicted by the real code/config — beyond what step 1 already requires for the change itself — propose the specific `CLAUDE.md`/`AGENT.md` sharpening in chat and get the user's explicit approval before writing it. Never apply a rule change unilaterally. If the user declines, leave the rule as-is and move on; the gate exists to keep rule evolution deliberate, not to force a change.

This formalizes exactly the pattern this design's own sections 1–4 followed (each proposed, then confirmed, before being written) as a durable rule for every future task, not just brainstorming-skill sessions.

---

## Decisions Ledger

Five new one-line entries appended to `DECISIONS.md` under "Frontend" / "Context & documentation system" as applicable:

- **D103** — Type-raising extended universally (Worker + browser, Zod + hand-authored); contract types relocated from top-level `types/` into owning domain folders (`pages/api/<domain>/types.ts`, new `@routes` alias); `types.ts` standardized as the sole barrel filename, replacing the 2 existing `index.ts` files; TS `interface` declarations raised through a parallel, separate `interfaces.ts` barrel chain (same mechanics, kept out of `types.ts`), excluding `.astro` frontmatter (D92) and `env.d.ts` ambient declarations.
- **D104** — Frontend test strategy formalized: new `06-Test-Strategy.md`, shared-mock convention (`tests/mocks/` + `setupFiles`), full-suite-always-runs completion policy.
- **D105** — Zero-exception rule: no `.ts` under `components/`/`pages/` except `pages/api/**`; `lib/<domain>/` always, named after `modules/`/`stores/` domain vocabulary; mechanically enforced via `scripts/check-file-locations.sh` (local + CI).
- **D106** — Centralized client-side error-message mapping (`lib/client/errors.ts`) keyed by the shared `ErrorCode` type; replaces ad hoc per-page mapping functions.
- **D107** — Self-learning gate added to the Context Maintenance protocol (step 8): rule sharpenings discovered mid-task require explicit user approval before being written, never applied unilaterally.

---

## Testing

- Every relocated/renamed file's consumers updated in the same change; `npm test` must show the same pass count as before (module moves, not behavior changes) minus the two mapping-function unit tests relocated into `errors.test.ts` (net same total, different file).
- `ProvisionedPlayer` interface relocation: no test currently exercises it directly (covered indirectly via `player.service.ts`/`provision.ts` integration paths), so this is a pure type-position change — `astro check` is the verification, not new test cases.
- `astro check` and `npx fallow` must pass after the alias changes (new `@services`/`@repositories`/`@db`/`@routes`, removed `@types`).
- `scripts/check-file-locations.sh` must pass (exercises the new gate against the already-clean tree).
- `scripts/check-context-map.sh` must pass.
- New `errors.test.ts` covers: known `ProvisionError` code → mapped message; unknown code → falls back to `err.message`; SDK credential-pattern message → `UNAUTHORIZED` copy; generic/unknown error → `FALLBACK`.

---

## Context Maintenance

Per the root `CLAUDE.md` mandatory protocol: `00-Context-Map.md` gets the new `06-Test-Strategy.md` row plus a context-pack entry and updated file-inventory rows for the relocated `types.ts` files; `DECISIONS.md` gets D103–D107; `scripts/check-context-map.sh` and the new `scripts/check-file-locations.sh` must both pass; `graphify-out/graph.json` refresh via `scripts/refresh-graph.sh` is required at completion given the volume of moved/renamed/new files; work continues on `refactor/organize-auth-data-files` and lands on `main` via the existing PR for that branch.
