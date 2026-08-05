<!--
status: canonical
scope: repository-wide decision ledger routing
read-when: "why was X decided?" before touching any history — routes to the domain file, doesn't hold the decisions itself
updated: 2026-08-05
-->

# Architectural Decision Ledger

> This file is a **router**, not a record. All 166 decisions (D01–D186: 163 migrated table rows plus D184's, D185's and D186's blocks, D01–D183 with 20 ids never issued — see the ID-gap note below) live in `decisions/**`, one domain file per row of the table below. This file holds only what's shared across all of them: the authority note, the Source key, the routing table, the Deferred list, and the rules for adding a new decision.
>
> Canonical docs always win over this ledger — a decision explains *why*, `docs/architecture/**` states *what is*. On conflict, `docs/architecture/00-Context-Map.md`'s authority order governs.
>
> **Source key:** P*n* = original design conversation prompt range · dates = later work sessions.

## Routing table

| Domain | File | Load when |
| ------ | ---- | --------- |
| Domain model | `decisions/architecture.md` | domain model, activity, session, stage, turn, dart, ruleset, platform, player, participant, configuration, snapshot, immutability |
| Database platform & process | `decisions/database.md` | schema, migration, table, column, constraint, index, view, Neon, seed, replay, ID strategy, denormalisation |
| API | `decisions/api.md` | endpoint, contract, envelope, auth, middleware, idempotency, batch, Worker, session, status, error code, validation, JWT |
| Game engines | `decisions/game-engine.md` | engine, GameEngine, ruleset, scoring, checkout, fact log, 501, Score Training, undo, leg, visit, bust, turns, darts |
| Testing | `decisions/testing.md` | test, TDD, Vitest, mock, coverage, fixture, test location, red-green, suite |
| Frontend architecture | `decisions/frontend/architecture.md` | layering, folder structure, suffix, barrel, type import, error mapping, API client, types, interfaces, error, import direction, aliases |
| Frontend Astro | `decisions/frontend/astro.md` | .astro, component, prerender, routing, layout, cn(), props, frontmatter, PWA, manifest, icon, safe-area, nav, page, slot, class composition |
| Frontend Alpine | `decisions/frontend/alpine.md` | Alpine, stores, state, persist, recovery, x-data, x-show, outbox, x-init, idempotency, auth gate, session recovery |
| Frontend style | `decisions/frontend/style.md` | style, CSS, token, Tailwind, primitive, typography, spacing, glass, surface, PWA, manifest, icon, safe-area, font, colour, dark mode, motion, accessibility |
| Context & documentation system | `decisions/context-system.md` | docs, context map, CLAUDE.md, skill, gate, check script, knowledge graph, CI, deploy, Prettier, format, husky, pre-commit, branch, PR, workflow, AGENT.md |

Each domain file's own front-matter carries the same `load-when` list plus `depends-on`/`related` — load those directly rather than re-deriving them here. `depends-on` files are assumed and load alongside the target file every time; `related` files are adjacent, load them only when the task actually spans domains.

## Deferred (open, not rejected)

ROUTINE_RUN entity / routine-run write path (P25, 2026-07-12; raw notes: `docs/game-rules/routines/`) · multi-session activities (2026-07-12) · guest/DartBot participants (2026-07-12) · `board_segments` lookup (P37) · dart coordinates `location_x/y` (P67, until UI capture) · event sourcing (P37) · zero-downtime migrations (P50) · PostgreSQL RLS (post-v1) · statistics endpoints overview/trends/checkouts + `v_statistics_overview` view (post-v1, 2026-07-12) · JSONB config key vocabulary review against game engines. · player_settings endpoints (2026-07-13) · configuration-preset CRUD (2026-07-13) · PATCH /api/players/me rename (2026-07-13) · per-dart thrown_at timestamp (2026-07-13) · 501 capture mode — DETAILED_DARTS, or a schema revision adding an attempted-score / void-visit fact, so a bust stops being indistinguishable from a scoreless visit and bust rate + true checkout attempts become computable (2026-07-26) · `scripts/check-context-map.sh` false positive — its migration-range regex cannot tell a seed range from a migration range, so a seed chain quoted as ending at 0003 is compared against the migration chain end and fails; worked around by rewording the affected doc line, script deliberately left unfixed (2026-07-26)

## Facts vs. decisions

Durable facts — schemas, contracts, inventories, what a system *is* — belong in `docs/architecture/`. This tree records only choices and their rationale: what was decided, why, and what it cost. A statement of what *is*, with no alternative weighed and no rationale, is not a decision and does not belong here.

## How to add a decision

Append a new block to the file matching the decision's domain (routing table above), after the existing table, at the end of the file — never inside it. Never create a new decision file without also adding it to the routing table above; `scripts/check-decision-ids.sh` fails any `decisions/**` file missing from this table.

- Next id is the current maximum plus one (`D185` at time of writing). Don't trust that number — derive it: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`. Migrated table rows and new blocks share one id space, so both patterns must be searched.
- Never reuse an id, never edit an existing decision's block. A reversal cites `Supersedes:` and gets its own new id.
- Block format:

```markdown
### D<next> — Short imperative title
Status: Accepted · Date: YYYY-MM-DD
Decision: …
Reason: …
Consequences: …
Supersedes: D86
```

`D<next>` and `YYYY-MM-DD` are placeholders — substitute the derived next id and today's date. (They are deliberately not a real id: an earlier draft used a concrete number, which was then issued as a real decision, so anyone copying the template verbatim would have collided with it.) `Supersedes:` is optional and omitted unless the decision reverses an earlier one; `Consequences:` is expected. See `decisions/context-system.md`'s D184 for a worked example.

## ID-gap note

Ids are non-contiguous: 166 decisions exist (163 migrated rows plus D184, D185 and D186), the highest is `D186`, and these 20 were never issued: `D18 D19 D29 D38 D39 D42 D43 D44 D45 D46 D47 D48 D49 D53 D54 D55 D56 D57 D58 D59`. These are numbering artifacts from the original distillation of the raw design history into this ledger (2026-07-11), not lost or deleted decisions. Do not renumber existing decisions or try to "fill" these ids.
