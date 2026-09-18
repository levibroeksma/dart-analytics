---
paths: ["**/*.engine.module.ts", "app/src/modules/game/**"]
---

# Game engines

Applies to `*.engine.module.ts` under `app/src/modules/game/`. Files under `app/src/modules/training/exercises/` share the suffix but **not** this contract — see `app/src/modules/training/CLAUDE.md` (D264).

Every `*.engine.module.ts` implements the `GameEngine` contract (`docs/architecture/04-Architecture-patterns.md` Pattern 18): constructed from a validated config snapshot bound to a `rulesetVersionKey`, owns its `EngineFacts` log, mints `clientKey`/`sequence`/`completedAt`/`participantRef`, rehydrates from persisted facts via `create(config, prior)`, and exposes a pure `wouldComplete(input)`.

- Every engine declares a static `stageOwnership` (`SHARED` | `PER_SEAT`) so `modules/game/seat-rota.module.ts` can derive the active seat from the fact log. `record()` takes no seat — it applies to the derived active seat, and the active seat is never stored. (2026-08-21)
- `undo()` is an exact inverse of `record()` over `facts()`, including any stage the record opened; undo depth is unbounded.
- `completedAt` is stamped when a visit resolves, never when it opens, and cleared when `undo()` reopens one.
- `state()` and `facts()` return derived copies — never a live field or a shared module constant. Anything a caller must change goes through a named method, not a write to a returned object.
- **Never store a value the fact log can derive** — no accumulated score, points, ratio or average fields.
- Compose log mechanics from `modules/game/turn-log.module.ts` and per-seat derivation from `modules/game/seat-state.module.ts` rather than re-declaring them. Copying a neighbouring engine's copy is what put `npx fallow` over its duplication gate once already (D232, 2026-08-23).
- A new engine's `rulesetVersionKey` and its server-side validator (`services/rulesets/registry.ts`) must land in the **same commit** — `scripts/check-game-engines.sh` runs pre-commit and rejects one without the other. (2026-08-14)
- `bash scripts/check-game-engines.sh` must pass. (2026-07-26)
