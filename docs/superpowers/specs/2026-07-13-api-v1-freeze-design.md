# API v1 Freeze — Finalize `06-API/`

> **Date:** 2026-07-13
> **Branch:** `claude/api-folder-finalization-g5tzdh`
> **Status:** design (approved for implementation planning)

---

## Goal

Bring the `06-API/` documentation folder to a coherent, frozen v1 so the
architecture design phase can close and work can move to the frontend layer.

Today `00-Overview.md` (1.2.0), `03-Shared-Conventions.md` (1.0.0), and
`04-Endpoint-Contracts.md` (1.0.0) are frozen, while
`01-Implementation-Strategy.md` and `02-Middleware-And-Layering.md` are still
`0.2.0` and carry contradictions with the frozen docs and with the real
`app/` scaffold. This task reconciles those two documents, applies one
controlled amendment to `03`, and freezes `01`/`02` at `1.0.0`.

**Scope: docs only.** No `app/tsconfig.json` alias edits, no folder moves, no
`types.ts` barrel files. The `@`-alias set and barrel convention are recorded
as documented target/intent for the frontend implementation phase to realize.

---

## Decisions taken (from brainstorming)

1. **Import convention:** `@`-prefixed path aliases (matching the actual
   scaffold, e.g. `@lib/*`, `@components/*`), **not** the `#`-prefixed aliases
   currently written in the frozen `03`.
2. **Type location + barrels:** TypeScript types live as close as possible to
   their source, but each area exposes a `types.ts` barrel that *raises* them,
   so every consumer imports a shallow path (`@services/types`,
   `@routes/types`, …) regardless of where the type is actually defined. No
   deep `@services/a/b/c/type` imports.
3. **Folder layout authority:** the documented tree follows the real scaffold —
   top-level `src/services/`, `src/repositories/`, `src/db/client.ts` — not
   `02`'s older `lib/`-nested layout. Consistent with the `@services/types`
   alias example.
4. **Statistics:** zero statistics endpoints in v1 (D63). The folder tree must
   not imply otherwise.

---

## Consistency issues being resolved

| # | Issue | Location | Resolution |
| - | ----- | -------- | ---------- |
| 1 | `statistics/overview.ts` in folder tree contradicts frozen defer (D63, `00`, `04`) | `02` folder tree | Remove the file from the tree; add "statistics deferred post-v1" note |
| 2 | Folder tree omits `types.ts` barrels + `#`-alias convention conflicts with the adopted `@` convention | `02` tree / `03` aliases | Amend `03` to `@`-aliases + type-raising barrels; add barrels to `02` tree |
| 3 | Docs vs scaffold drift: `src/lib/services` vs real `src/services`; `src/lib/db/client.ts` vs real `src/db/client.ts` | `02` tree | Rewrite tree to the real top-level layout |
| 4 | Stale cross-references: `01`/`02` omit `03`/`04`; `03`/`04` date `01`/`02` as `2026-07-10` | `01`, `02`, `03`, `00` Related Documents | Add `03`/`04` to `01`/`02`; refresh dates |
| 5 | `01` middleware flow diagram predates `02`'s route-class model (no public/provision-exempt classes) | `01` request-flow (lines ~111-130) | Point the flow at `02` as the route-class owner instead of restating an outdated flat flow |

---

## Per-file changes

### `03-Shared-Conventions.md` — amend, bump `1.0.0` → `1.1.0`
- Replace `#types/ #routes/ #services/` examples with `@`-prefixed equivalents.
- Restate the barrel rule as **type-raising**: types defined next to source;
  each area's `types.ts` barrel re-exports them; consumers import
  `@<area>/types` only. No deep import chains.
- Refresh the `2026-07-10` Related-Documents dates for `01`/`02`.
- Dated note (`2026-07-13`) recording the amendment.

This is a controlled amendment to a frozen doc, authorized by a direct user
instruction (rank 1 in the authority order). The frozen *response contracts*
in `03`/`04` are unaffected; only the alias spelling and barrel wording change.

### `02-Middleware-And-Layering.md` — reconcile, bump `0.2.0` → `1.0.0` (frozen v1)
- Remove `statistics/overview.ts` from the folder tree; add a one-line
  "statistics endpoints deferred post-v1 (D63)" note.
- Rewrite the folder tree to the real scaffold layout: top-level
  `src/services/`, `src/repositories/`, `src/db/client.ts`; keep
  `src/lib/{api,auth}/`, `src/lib/env.ts`, `src/lib/id.ts`.
- Add per-area `types.ts` barrels to the tree.
- Add a "Path aliases & type barrels" note: points to `03` as the convention
  owner, lists the target alias set (`@services`, `@repositories`, `@routes`,
  `@lib`, `@db`) as documented intent (not yet in `tsconfig.json`).
- Add `03` and `04` to Related Documents.

### `01-Implementation-Strategy.md` — reconcile, bump `0.2.0` → `1.0.0` (frozen v1)
- Update the middleware request-flow section to reference `02`'s route-class
  model (public / protected / provision-exempt) rather than restating a flat
  flow, keeping `02` the single owner of the flow to prevent re-drift.
- Add `03` and `04` to Related Documents.

### `00-Overview.md` — light touch
- Refresh Related-Documents dates for `01`/`02`.
- Confirm no reference to the removed statistics file path. No version bump.

---

## Context-maintenance (mandatory, per root `CLAUDE.md`)

- `00-Context-Map.md`: bump map version; update the "API docs" row in Current
  Implementation State and the `01`/`02` inventory rows (status now frozen v1);
  ISO-date the changed rows `2026-07-13`.
- `architecture/DECISIONS.md`: add **D66** — "`06-API/` frozen v1; `@`-alias +
  type-raising barrel convention adopted; `01`/`02` frozen at `1.0.0`,
  `03`→`1.1.0`."
- Run `scripts/check-context-map.sh`; must pass.

---

## Non-goals / deferred

- No `app/tsconfig.json` alias additions (`@services`, `@repositories`, …).
- No creation of `types.ts` barrel files.
- No folder moves in `app/src/`.
- No changes to `04-Endpoint-Contracts.md` response contracts.
- Statistics endpoints and their `v_*` views remain post-v1 (unchanged).

These belong to the frontend / API implementation phase, which consumes this
frozen contract.

---

## Success criteria

1. `01` and `02` are `1.0.0` and internally consistent with `00`/`03`/`04`.
2. No document implies a v1 statistics endpoint.
3. One alias convention (`@`-prefixed) and one barrel rule (type-raising)
   across `02` and `03`.
4. `02`'s folder tree matches the real `app/src/` top-level layout.
5. Cross-reference tables are mutually complete and correctly dated.
6. Context map, DECISIONS ledger updated; `check-context-map.sh` passes.
