# Agent Rules — `app/src/services/`

Scope: the service layer — domain workflows between route handlers and repositories. Load the "New API endpoint" or "API middleware / layering change" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. Global app rules and the validation procedure live in `app/CLAUDE.md`. (2026-09-18)

## Rules

- Handlers stay thin; this layer owns the workflow. Never parse a JWT here — middleware verifies identity, services handle domain authorization.
- Mint UUIDv7 here for every runtime persistence record. The database never generates ids, and neither does the handler.
- Reads go through views (`v_*`); writes go to runtime tables inside a transaction.
- **Request schemas mirror the column CHECK constraints of the tables they write.** A bound the database enforces (`chk_*` in `database/migrations/`) belongs beside the field's type in the shared Zod schema, once — not restated per ruleset validator, which keeps only ruleset rules. A value the schema lets through and the database rejects aborts the write transaction and fails the whole batch with a 500 instead of a `VALIDATION_FAILED` naming the offending record. `scripts/check-constraint-mirror.sh` enforces the anchor.
- **Two ruleset registries, kept apart.** `services/rulesets/registry.ts` holds game rulesets; `services/exercise-rulesets/registry.ts` holds exercise rulesets, and `ExerciseRulesetVersionKey` never enters the game union (D264). `scripts/check-game-wiring.sh` requires every key in the game registry to declare a capture/input mode pair, which an exercise has neither of.
- A new game engine's `rulesetVersionKey` and its server-side validator here must land in the **same commit** — `scripts/check-game-engines.sh` runs pre-commit and rejects one without the other, so a plan that splits them into separate commits cannot land as drafted.
