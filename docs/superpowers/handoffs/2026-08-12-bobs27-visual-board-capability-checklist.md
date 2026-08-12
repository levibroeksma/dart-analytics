# Operator Checklist — Bob's 27 ANALYTICS + VISUAL_BOARD Capability (Phase 2)

> **Date:** 2026-08-12
> **Branch:** `bobs27-phase-2-visual-board-capability`
> **Plan:** `docs/superpowers/plans/2026-08-12-bobs27-phase2-visual-board-capability.md`
> **State:** Code and tests complete and green in this container. The one step below could not run here (no `DATABASE_URL`) and needs the owner to run it against Neon before a Bob's 27 visual-board session can actually be created in production.

## What changed

`database/seeds/0007_ruleset_version_capabilities.sql` gained one row: `('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD')`, alongside its existing `('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS')` row. No migration, no schema change — `ruleset_version_capabilities` already exists (migration `0020`'s `fk_sessions_capability` already depends on it being populated for every combination a session might request).

## Why this matters before merge reaches production

Migration `0020`'s composite FK makes an undeclared `(ruleset_version_id, capture_mode_id, input_mode_id)` triple physically unstorable in `exercise_sessions`. The code-side capability check (`capabilities.ts`'s `RULESET_CAPABILITIES`, checked via `supportsMode` in `session.service.ts`) now accepts `BOBS27_V1` + `ANALYTICS` + `VISUAL_BOARD` — but until the seed row is applied to the real database, a session creation call that passes the code-side check will still fail at insert on the FK, because the database doesn't have the row yet.

## Step: re-apply seed `0007`

```bash
npm run db:seed
```

The seed is idempotent (`ON CONFLICT DO NOTHING`), so re-running it is always safe, including on a database that already has the other 8 rows from Phase 1/earlier work.

Confirm the new row landed:

```sql
SELECT rv.implementation_key, cm.implementation_key, im.implementation_key
FROM ruleset_version_capabilities c
JOIN ruleset_versions rv ON rv.id = c.ruleset_version_id
JOIN capture_modes cm ON cm.id = c.capture_mode_id
JOIN input_modes im ON im.id = c.input_mode_id
WHERE rv.implementation_key = 'BOBS27_V1';
```

Expected: two rows — `BOBS27_V1 | RECREATIONAL | DETAILED_DARTS` and `BOBS27_V1 | ANALYTICS | VISUAL_BOARD`.

## Step: run the verification script

```bash
psql "$DATABASE_URL" -f database/verification/0007_capability_seed_checks.sql
```

Expected: `ALL 9 CHECKS PASSED` (was 8 before this phase — the new row adds one to the fixed-count assertions in Steps 1 and 2). If any row reads `FAIL`, its `detail` column carries the observed value against the expected one.

## Explicitly NOT in scope (deferred to Phase 3/4)

- No UI can create a Bob's 27 visual-board session yet — `BOBS27_V1` has no entry in `games-visibility.ts`'s `GAME_CARDS`, so the setup/play pages for it don't exist until Phase 3/4 land. This checklist only unblocks the database side.

## When ready to open the PR

This step can be run any time before or shortly after merge — nothing in this phase's own test suite depends on it (all Vitest coverage is DB-independent). It only needs to land before Phase 3/4's UI work goes live, since that's what will first attempt to create a session under this pair.
