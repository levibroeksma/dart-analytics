# Operator Checklist — Visual Board Capture Core (Plan 1)

> **Date:** 2026-08-05
> **Branch:** `claude/visual-darts-input-28gjzh`
> **Plan:** `docs/superpowers/plans/2026-08-05-visual-board-capture-core.md`
> **State at handoff:** all 15 tasks implemented, tested (Vitest + `tsc --noEmit`) and documented in-branch. **No database in this environment** — migrations `0017`/`0018` and seeds `0005`/`0006` have never been applied or verified against real PostgreSQL. `app/src/db/schema.ts` was hand-edited to add `locationX`/`locationY`/`chk_dart_location_pair` (see `decisions/database.md` D188) because `drizzle-kit introspect` could not run here — it is un-regenerated. The steps below are the parts that require a **Neon-connected desktop** and must run, in order, before this plan is considered verified end to end.

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

## Why these steps aren't done here

No database is reachable from this container: `db:migrate`, `db:seed`, `drizzle-kit introspect`, and every query above require a live Postgres connection. The SQL (`0017`, `0018`, seeds `0005`/`0006`), the hand-written `schema.ts` edit, and every document describing them were authored, reviewed, and unit-tested (`app/tests/**`, `vitest`) against the classifier and validator logic directly — but nothing here has touched a real database, so none of the above is independently confirmed. The repo owner approved shipping the SQL plus this checklist rather than blocking the branch on desktop access (`.superpowers/sdd/progress.md`, "Human decisions", 2026-08-05).

---

## Explicitly NOT in scope (deferred to plan 2)

- The input-mode capability table, its seed rows, the composite FK, the cross-runtime capability constant, and `check-game-engines.sh`'s input-mode assertion.
- Settings endpoints for choosing VISUAL_BOARD as a default input mode.
- Any UI for the actual tap-to-throw board — this plan is capture-core only (classifier, geometry, persistence, read model); frontend board interaction is a later plan.

---

## When ready to open the PR

Base `main` ← `claude/visual-darts-input-28gjzh`. Run steps 1–5 above on a Neon-connected desktop first and commit any resulting `schema.ts` diff (step 2) into the same branch, so the PR carries a real introspect run rather than the hand-edit alone. Use the repo PR template.
