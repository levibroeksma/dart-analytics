<!--
status: canonical
scope: decisions/database
read-when: why a schema choice was made
load-when: schema, migration, Neon, view, seed
depends-on: none
updated: 2026-09-20
-->

| #   | Source     | Decision                                                         | Rationale                 |
| --- | ---------- | ---------------------------------------------------------------- | ------------------------- |
| D20 | P21–30     | CQRS-lite: writes go to runtime tables, reads go via `v_*` views | Stable read contracts     |
| D23 | 2026-07-09 | dbmate owns migrations; Drizzle never generates schema           | Keeps SQL chain canonical |

### D100 — Dart coordinates ship as millimetres

Status: Accepted · Date: 2026-08-05
Decision: `darts.location_x` ships as `NUMERIC(6, 2)` millimetres.
Reason: A landing point is one fact.
Consequences: Migration `0017` also adds two foreign keys.
Supersedes: none.

### D101 — Coordinates become centimetres

Status: Accepted · Date: 2026-09-01
Decision: coordinates ship as centimetres.
Reason: Smaller numbers read better in the view.
Consequences: Clients divide by ten.
Supersedes: D100.

### D102 — Seed list runs twice

Status: Accepted · Date: 2026-09-10
Decision: `db:seed` runs the full seed list twice.
Reason: First paragraph of the reason, about the Neon branch.

Second paragraph of the reason, after a blank line.
Consequences: The second run proves idempotency.
Supersedes: none (extends D41)
