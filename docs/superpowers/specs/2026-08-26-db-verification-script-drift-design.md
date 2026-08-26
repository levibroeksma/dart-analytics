# DB Verification Script Drift — Design

Closes findings **F7**, **F11**, **F13**. Group B of the FINDINGS.md triage
(2026-08-23): database verification scripts under `database/verification/`
that have drifted from what they actually check.

## Problem

Three independent defects in the same subsystem:

- **F7** — `0008_shanghai_capability_checks.sql`, `0009_121_capability_checks.sql`,
  `0010_around_the_clock_capability_checks.sql` each assert the *whole table*
  holds an exact row count (10 / 11 / 12) as of the game they were written
  for. `seeds/0007_ruleset_version_capabilities.sql` is the single running
  ledger every ruleset's capability rows are appended to, and it now holds 18
  rows (9 games). All three scripts are stale today — run via
  `npm run db:verify`, each would FAIL its Step 2 against a live database
  that has every seed applied, because the pattern requires editing every
  earlier per-game script whenever a new game ships.
- **F11** — `0007_capability_seed_checks.sql` (lines 117-118) carries a
  comment claiming a "fixed 9-row VALUES list" as the reason its own
  triple-count-ran guard can only be short. The VALUES list has held far
  more than 9 rows since before this comment was last true; it was never
  updated when the counts around it (9→18) were.
- **F13** — migration `0023_owner_scoped_dart_views.sql` restricted
  `v_dart_analytics` and `v_dart_locations` to the session owner's own
  participant (excluding a GUEST's darts), and left `v_game_replay`
  deliberately unfiltered. Neither view has a `database/verification/*.sql`
  script proving this — the one case worth proving (a session with one
  PLAYER and one GUEST returns only the PLAYER's darts through the two
  scoped views, while `v_game_replay` returns both) is untested.

## Scope

In scope: `database/verification/0008_*.sql`, `0009_*.sql`, `0010_*.sql`,
`0007_capability_seed_checks.sql` (comment only), and a new
`database/verification/0023_owner_scoped_dart_view_checks.sql`. No migration,
seed, or application code changes — this is verification-script-only, so no
`app/` files are touched and `check-test-coverage.sh` does not apply.

0008 is included even though F7's evidence names only 0009/0010: it carries
the identical defect (stale full-table count), and the fix is the same
mechanical change — leaving it in place would recreate the exact bug this
task closes.

## F7 fix: narrow per-game scripts to their own rows

Full bidirectional parity against `capabilities.ts` already lives in
`0007_capability_seed_checks.sql`:

- Step 1 asserts the table's total row count (currently 18, updated in
  place whenever `seeds/0007` grows — confirmed accurate as of this task).
- Step 4 asserts the table holds no row outside the declared set (and
  Step 2 the converse: every declared triple resolves).

`0007` already re-verifies the *entire* table on every run, because the seed
file itself is one running ledger. The per-game scripts (0008/9/10) were
never structurally necessary for full-table parity — they exist to prove
each game's own additive row resolved, at the time that game shipped.

Fix: in each of 0008, 0009, 0010, remove Step 2's `count(*) = N` full-table
assertion and its accompanying comment block. Keep:

- Step 1 (own triple resolves through the `implementation_key` joins) —
  unchanged.
- Step 3, renumbered to Step 2 (no exercise_sessions row left undeclared) —
  unchanged in content.

Update each script's header comment block to drop the "table now holds
exactly N triples" bullet and the numbering it implies. Update the `Results`
section's step references only if renumbering requires it (it does — old
Step 3 becomes Step 2 in each file).

This makes each per-game script self-contained proof of *its own* addition,
with the table-wide count owned in exactly one place. Adding game ten no
longer requires editing 0008, 0009, and 0010.

## F11 fix: reword the stale comment

`0007_capability_seed_checks.sql` lines 117-118:

```sql
-- Driven by a fixed 9-row VALUES list, so this can only be short if the
-- VALUES list above was edited down — guard it anyway per house style.
```

Replace with a description of what the guard actually checks, independent of
any specific count:

```sql
-- Guards against a future edit shortening the VALUES list above without
-- updating the counts this script asserts — the check-count would then
-- silently read as fewer triples checked, not FAIL.
```

## F13 fix: new verification script for the owner-scoped dart views

New file `database/verification/0023_owner_scoped_dart_view_checks.sql`,
following `0022_player_profile_checks.sql`'s shape: one transaction, own
fixture, ends in `ROLLBACK`, resolves lookups by `implementation_key`.

**Fixture:** one `exercise_sessions` row owned by a fixture player (session
owner), with two `participants`:

- Participant A — `participant_type_id` for `PLAYER`, `player_id` = the
  session owner.
- Participant B — `participant_type_id` for `GUEST`, `player_id` NULL,
  `display_name` = a fixture guest name.

Each participant gets one `turns` row and one `darts` row, both satisfying
both views' `WHERE` clauses simultaneously (so a single dart per participant
proves both views at once): `intended_target_number`/`intended_zone_id` set
(required by `v_dart_analytics`) **and** `location_x`/`location_y` set
(required by `v_dart_locations`).

**Assertions:**

1. `v_dart_analytics` filtered to the fixture session returns exactly 1 row,
   and that row's data matches participant A's dart (not B's).
2. `v_dart_locations` filtered to the fixture session returns exactly 1 row,
   matching participant A's dart.
3. `v_game_replay` filtered to the fixture session returns 2 turn rows (one
   per participant) — proving the lack of owner-scoping there is the
   documented, deliberate behaviour (migration 0023's own comment), not an
   oversight this task is failing to also fix.
4. Anti-vacuity guard (D192 house style): assert the count of checks that
   actually ran, so a broken view that silently returns 0 rows fails loudly
   rather than vanishing from the results.

Minimum required FKs for the fixture (activity, game type, ruleset version,
capture/input mode, status, stage type) are resolved the same way
`0020_capability_fk_checks.sql` resolves them — by `implementation_key`
lookup inside the script, using any one existing ruleset (e.g. `TUOD_V1`,
already used as the fixture ruleset in `0020`) rather than hardcoding a
game-specific one.

## Testing / verification

None of these changes touch `app/` — no Vitest coverage applies. Per D193
(and the established gap in this execution container — no `DATABASE_URL`),
the new and edited scripts cannot be run here. The commit message and PR
description will note that `database/verification/0008*.sql`, `0009*.sql`,
`0010*.sql`, and the new `0023*.sql` need a `npm run db:verify` pass against
the live Neon database before merge, consistent with every prior task that
touched this directory.

Local checks that do run in this container: `scripts/check-context-map.sh`
and the standard context-maintenance gates, since this task also needs to
register itself in `docs/architecture/00-Context-Map-History.md` and close
F7/F11/F13 in `FINDINGS.md`.
