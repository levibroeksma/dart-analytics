# Operator Checklist — Visual Board Capture Core (Plan 1)

> **Date:** 2026-08-05 · **Verified against real PostgreSQL 16:** 2026-08-08
> **Branch:** `claude/visual-darts-input-28gjzh`
> **Plan:** `docs/superpowers/plans/2026-08-05-visual-board-capture-core.md`
> **State:** all 15 tasks implemented, tested (Vitest + `tsc --noEmit`) and documented in-branch. Steps 1–5 below have now been **run end to end against a throwaway local PostgreSQL 16 cluster** — the full `0001`–`0018` chain, seeds `0001`–`0006`, `drizzle-kit introspect`, and every verification query. What that run found and fixed is recorded under "What the real-database run changed". What remains is the **Neon re-run**: Neon's PostgreSQL version and pooled connection are not this cluster, and the target database is the one that matters.

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

### 3. Verify `chk_dart_location_pair` actually rejects a half-set pair

```sql
-- Expect: ERROR — violates check constraint "chk_dart_location_pair"
INSERT INTO darts (id, turn_id, dart_number, score, location_x, location_y)
VALUES ('<a real turn_id>'::uuid, '<a real turn_id>'::uuid, 1, 20, 50.0, NULL);
```

(Use a real `turn_id` from a test session; the point is the constraint fires on `location_y IS NULL` while `location_x` is set — not the FK. A row with both NULL, or both set, must succeed.)

### 4. Query `v_dart_locations` and confirm the angle convention

Insert (or use existing) VISUAL_BOARD darts at the four cardinal points and confirm `angle_degrees` matches the classifier's clockwise-from-up convention:

```sql
SELECT location_x, location_y, radius_mm, angle_degrees
FROM v_dart_locations
WHERE session_id = '<a visual-board session id>'
ORDER BY dart_number;
```

Expected: a dart at `(x=0, y=-100)` (straight up from the bull) reads `angle_degrees = 0`; a dart at `(x=100, y=0)` (straight right) reads `angle_degrees = 90`. These two cardinals were verified against `classify()`/`board-geometry.module.ts` in-session (Task 13); this step is the live-database confirmation the in-session unit tests couldn't provide.

### 5. Confirm the bust/scoreless divergence persists correctly

Play (or script) a VISUAL_BOARD 501 session to a busted visit, then check:

```sql
SELECT t.id, t.total_score, array_agg(d.score ORDER BY d.dart_number) AS dart_scores
FROM turns t
JOIN darts d ON d.turn_id = t.id
WHERE t.id = '<the busted visit''s turn id>'
GROUP BY t.id, t.total_score;
```

Expected: `total_score = 0` while `dart_scores` contains at least one non-zero value. That divergence — counted zero against thrown non-zero — is the fact `06-Spec/04-Runtime-Layer.md`'s "Retired for VISUAL_BOARD sessions" note and decision D189 depend on. A row where `total_score` equals the sum of `dart_scores` is an ordinary (non-bust) visit and does not exercise this check — repeat against a genuinely busted visit if the first query returns that shape.

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

Everything else in the branch was authored and unit-tested (`app/tests/**`, Vitest) against the classifier and validator logic directly. The repo owner approved shipping the SQL plus this checklist rather than blocking the branch on desktop access (`.superpowers/sdd/progress.md`, "Human decisions", 2026-08-05).

## Still to do on Neon

Re-run steps 1 and 3–5 against the Neon dev branch. The local cluster is PostgreSQL 16 on a direct connection; Neon differs in version and runs pooled, and it is the database this app actually writes to. Step 2's introspect is already committed from a real run — re-running it on Neon is only worth it if step 1 there produces a different schema.

---

## Explicitly NOT in scope (deferred to plan 2)

- The input-mode capability table, its seed rows, the composite FK, the cross-runtime capability constant, and `check-game-engines.sh`'s input-mode assertion.
- Settings endpoints for choosing VISUAL_BOARD as a default input mode.
- Any UI for the actual tap-to-throw board — this plan is capture-core only (classifier, geometry, persistence, read model); frontend board interaction is a later plan.

---

## When ready to open the PR

Base `main` ← `claude/visual-darts-input-28gjzh`. The branch already carries a real introspect run (step 2) and the `0018` fix that the local run surfaced. Run steps 1 and 3–5 against the Neon dev branch before merging, and commit any further `schema.ts` diff into the same branch. Use the repo PR template.
