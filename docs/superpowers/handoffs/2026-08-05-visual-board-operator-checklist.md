# Operator Checklist — Visual Board Capture Core (Plan 1)

> **Date:** 2026-08-05 · **Verified on Neon:** 2026-08-08
> **Branch:** `claude/visual-darts-input-28gjzh`
> **Plan:** `docs/superpowers/plans/2026-08-05-visual-board-capture-core.md`
> **State:** **Complete.** All 15 tasks implemented, tested (Vitest + `tsc --noEmit`) and documented in-branch. Every step below has been run against a throwaway local PostgreSQL 16 cluster *and* against the Neon dev branch — the full `0001`–`0018` chain, seeds `0001`–`0006`, `drizzle-kit introspect`, and all 11 verification checks. What the local run found and fixed is recorded under "What the real-database run changed"; the Neon results are under "Neon run". Nothing on this checklist is outstanding.

---

## Steps (run in order, from `app/`, against a Neon dev branch)

### 1. Apply the migration chain and seeds

```bash
npm run db:status      # expect: 0017_dart_locations.sql and 0018_dart_location_read_model.sql pending
npm run db:migrate      # runs the full chain through 0018
npm run db:seed         # runs seeds 0001–0006 in order, incl. 0005 (VISUAL_BOARD) and 0006 (INNER_SINGLE/OUTER_SINGLE)
```

Confirm `input_modes` gained id 3 (`VISUAL_BOARD`) and `dart_zones` gained ids 7/8 (`INNER_SINGLE`/`OUTER_SINGLE`):

```sql
SELECT id, implementation_key FROM input_modes ORDER BY id;
SELECT id, implementation_key FROM dart_zones ORDER BY id;
```

### 2. Re-introspect and diff against the hand-written schema

`app/src/db/schema.ts`'s `darts` table already declares `locationX`/`locationY` and `chk_dart_location_pair` by hand (D188) — this step is the check that proves the hand-written shape matches what Drizzle would have generated, not a fresh write.

```bash
drizzle-kit introspect
git diff -- src/db/schema.ts
```

Expected: the diff is empty, or differs only in generator formatting/comments — **not** in column names, types (`numeric("location_x", { precision: 6, scale: 2 })`), nullability, or the `chk_dart_location_pair` CHECK expression. If introspect produces a materially different shape (different precision/scale, a missing constraint, a renamed column), the hand-written schema was wrong and must be fixed to match the real database before this plan is considered verified — the database is the source of truth, not the hand-edit. Commit the (expected-empty) diff either way so the branch carries a real introspect run.

### 3–5. Run the verification script

Steps 3, 4 and 5 are one committed script. They used to be prose asking the operator to hunt for a real `turn_id` and hand-type inserts against it — the shape of a step that gets skipped. The script builds its own fixture, runs every check, prints one PASS/FAIL row each, and ends in `ROLLBACK`, so it is safe against a seeded dev database and leaves nothing behind (D193).

```bash
npm run db:verify 0018
```

(There is no local `psql` — this project has no local PostgreSQL server, so the runner goes through `postgres.js`. `psql "$DATABASE_URL" -f ../database/verification/0018_visual_board_checks.sql` is equivalent where the client is installed.)

Expected: `ALL 11 CHECKS PASSED`. What it covers:

| Step | Checks |
| ---- | ------ |
| 3 | `chk_dart_location_pair` rejects x-without-y and y-without-x, and accepts both-NULL. Each attempt runs in its own exception block, so a rejection doesn't abort the run. |
| 4 | `v_dart_locations` reads `0/90/180/270°` at the four cardinals (clockwise bearing from the upward vertical, matching `classify()`'s sector convention) with `radius_mm = 100`; a coordinate-less dart is excluded; `input_mode_key` is `VISUAL_BOARD`. A separate count assertion stops an empty view from reporting a vacuous pass. |
| 5 | A busted visit persists `total_score = 0` alongside a dart scoring 11 — the counted-zero-against-thrown-non-zero divergence that `06-Spec/04-Runtime-Layer.md`'s "Retired for VISUAL_BOARD sessions" note and D189 depend on. |

If a row reads FAIL, its `detail` column carries the observed value against the expected one.

---

## What the real-database run changed (2026-08-08)

The container turned out to carry a PostgreSQL 16 server binary, so the chain was run against a throwaway local cluster rather than left unverified.

**Migration `0018` could never have applied.** Its angle expression was `MOD(DEGREES(ATAN2(x, -y)) + 360, 360)`, and PostgreSQL has no `mod(double precision, integer)` — the double→numeric cast is assignment-only, so it is not considered during function resolution. `CREATE VIEW` failed with `function mod(double precision, integer) does not exist`; `v_dart_locations` was never created and `0018` was never recorded. Fixed in place with a `::NUMERIC` cast (D192) — `0018` had applied to no database, so the "never modify applied migrations" invariant is untouched. `app/tests/db/migration-numeric-typing.test.ts` now fails any migration that repeats the shape.

**Results of each step against the local cluster:**

| Step | Result |
| ---- | ------ |
| 1. Migrate + seed | `0001`–`0018` applied; seeds `0001`–`0006` applied. `input_modes` = `QUICK_SCORE`/`DETAILED_DARTS`/`VISUAL_BOARD`; `dart_zones` ids 7/8 = `INNER_SINGLE`/`OUTER_SINGLE`. |
| 2. Introspect | Ran against the live cluster. The hand-written `locationX`/`locationY` (`numeric`, precision 6, scale 2) and `chk_dart_location_pair` match generated output **exactly**; `v_dart_locations` is now registered as `vDartLocations`. The remaining churn is drizzle-kit's unstable per-index `.op()` operator classes, which reshuffle between runs and describe nothing the app reads. |
| 3. `chk_dart_location_pair` | x-only → rejected; y-only → rejected; both NULL → accepted. |
| 4. `v_dart_locations` angles | `(0,-100)` → `0°` (sector 20), `(100,0)` → `90°` (6), `(0,100)` → `180°` (3), `(-100,0)` → `270°` (11). All four match `SECTOR_ORDER` and the classifier's clockwise-from-up convention. Coordinate-less darts are correctly excluded. |
| 5. Bust divergence | A visit with `total_score = 0` alongside a dart scoring 11 persists exactly that shape — counted zero against thrown non-zero, the fact D189 depends on. |

Steps 3–5 were then captured as `database/verification/0018_visual_board_checks.sql` so the run is repeatable rather than a one-off. The script was proved non-vacuous by swapping the view's angle expression to `ATAN2(y, x)` (the counter-clockwise-from-east convention): 4 of its 11 checks went red.

Everything else in the branch was authored and unit-tested (`app/tests/**`, Vitest) against the classifier and validator logic directly. The repo owner approved shipping the SQL plus this checklist rather than blocking the branch on desktop access (`.superpowers/sdd/progress.md`, "Human decisions", 2026-08-05).

## Neon run (2026-08-08)

**Step 1 is done.** The operator ran `npm run db:migrate` and `npm run db:seed` against Neon. The first attempt predated the `0018` fix and failed with the identical error the local cluster produced — `pq: function mod(double precision, integer) does not exist` — independent confirmation that the defect was real on the actual target, not an artifact of the throwaway cluster. After pulling the `::NUMERIC` fix, migrations and all six seeds applied cleanly.

**Steps 3–5 are done.** `npm run db:verify` against the Neon dev branch returns `ALL 11 CHECKS PASSED` — every result identical to the local cluster: the constraint rejects both half-set pairs and accepts both-NULL, the four cardinals read `0/90/180/270°` at `radius_mm = 100`, the coordinate-less dart is excluded, `input_mode_key` is `VISUAL_BOARD` on all five rows, and the busted visit holds `total_score = 0` against a dart scoring 11. Neon's PostgreSQL build and its pooler agree with PostgreSQL 16 on all of it, including the `NUMERIC` angle arithmetic that `0018` originally got wrong.

Step 2's introspect is already committed from a real run — re-running it on Neon is only worth it if step 1 there produces a different schema, and it did not.

**Nothing on this checklist remains open.**

---

## Explicitly NOT in scope (deferred to plan 2)

- The input-mode capability table, its seed rows, the composite FK, the cross-runtime capability constant, and `check-game-engines.sh`'s input-mode assertion.
- Settings endpoints for choosing VISUAL_BOARD as a default input mode.
- Any UI for the actual tap-to-throw board — this plan is capture-core only (classifier, geometry, persistence, read model); frontend board interaction is a later plan.

---

## When ready to open the PR

Base `main` ← `claude/visual-darts-input-28gjzh`. Every prerequisite is met: the branch carries a real introspect run (step 2), the `0018` fix the local run surfaced, and a Neon run of steps 1 and 3–5 that came back green. Use the repo PR template.
