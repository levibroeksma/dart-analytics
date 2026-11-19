<!--
status: canonical
scope: repository-wide decision ledger routing
read-when: "why was X decided?" before touching any history — routes to the domain file, doesn't hold the decisions itself
updated: 2026-11-19
-->

# Architectural Decision Ledger

> This file is a **router**, not a record. All decisions live in `decisions/**`, one MADR record file per decision, one directory per row of the table below (20 ids never issued — see the ID-gap note below). This file holds only what's shared across all of them: the authority note, the Source key, the routing table, the Deferred list, and the rules for adding a new decision.
>
> Canonical docs always win over this ledger — a decision explains *why*, `docs/architecture/**` states *what is*. On conflict, `docs/architecture/00-Context-Map.md`'s authority order governs.
>
> **Source key:** P*n* = original design conversation prompt range · dates = later work sessions.

## Routing table

| Domain | Directory | Load when |
| ------ | ---- | --------- |
| Domain model | `decisions/architecture/` | domain model, activity, session, stage, turn, dart, ruleset, platform, player, participant, configuration, snapshot, immutability, capability, capture mode, input mode |
| Database platform & process | `decisions/database/` | schema, migration, table, column, constraint, index, view, Neon, seed, replay, ID strategy, denormalisation |
| API | `decisions/api/` | endpoint, contract, envelope, auth, middleware, idempotency, batch, Worker, session, status, error code, validation, JWT |
| Game engines | `decisions/game-engine/` | engine, GameEngine, ruleset, scoring, checkout, fact log, 501, Score Training, undo, leg, visit, bust, turns, darts |
| Testing | `decisions/testing/` | test, TDD, Vitest, mock, coverage, fixture, test location, red-green, suite |
| Frontend architecture | `decisions/frontend/architecture/` | layering, folder structure, suffix, barrel, type import, error mapping, API client, types, interfaces, error, import direction, aliases |
| Frontend Astro | `decisions/frontend/astro/` | .astro, component, prerender, routing, layout, cn(), props, frontmatter, PWA, manifest, icon, safe-area, nav, page, slot, class composition |
| Frontend Alpine | `decisions/frontend/alpine/` | Alpine, stores, state, persist, recovery, x-data, x-show, outbox, x-init, idempotency, auth gate, session recovery |
| Frontend style | `decisions/frontend/style/` | style, CSS, token, Tailwind, primitive, typography, spacing, glass, surface, PWA, manifest, icon, safe-area, font, colour, dark mode, motion, accessibility |
| Context & documentation system | `decisions/context-system/` | docs, context map, CLAUDE.md, skill, gate, check script, knowledge graph, CI, deploy, Prettier, format, husky, pre-commit, branch, PR, workflow, AGENT.md |

Each record's front-matter carries `tags`, `status`, `supersedes` and `superseded-by`. Find records with `scripts/decision-index.sh` (see "How to find a decision"), never by reading a directory whole.

## Deferred (open, not rejected)

> Unbuilt things defer here. Broken things go to a GitHub issue (`discovered-work` label, `capturing-discovered-work` skill).

guest-adding UI for the other 8 setup screens beyond 501 (2026-08-21; 501 shipped, D225) · `board_segments` lookup (P37) · event sourcing (P37) · zero-downtime migrations (P50) · PostgreSQL RLS (post-v1) · statistics endpoints overview/trends/checkouts + `v_statistics_overview` view (post-v1, 2026-07-12) · JSONB config key vocabulary review against game engines. · configuration-preset CRUD (2026-07-13) · per-dart thrown_at timestamp (2026-07-13) · 501 capture mode — DETAILED_DARTS, or a schema revision adding an attempted-score / void-visit fact, so a bust stops being indistinguishable from a scoreless visit and bust rate + true checkout attempts become computable (2026-07-26) · copy-on-share custom routines, incl. recipient identification (`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` §6) · schedule adherence — "did the player train on the scheduled day", derivable from `activities.started_at` once a schedule's history is kept rather than overwritten on edit (`docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md` §9)

## Facts vs. decisions

Durable facts — schemas, contracts, inventories, what a system *is* — belong in `docs/architecture/`. This tree records only choices and their rationale: what was decided, why, and what it cost. A statement of what *is*, with no alternative weighed and no rationale, is not a decision and does not belong here.

## How to find a decision

1. Run `bash scripts/decision-index.sh --domain <directory>` for one routing-table row, or `--tag <tag>` / `--status <status>` to filter across domains.
2. Read the one-line rows. Each names the record file.
3. Read only the record files your task needs.

## How to add a decision

1. Pick the domain directory from the routing table above.
2. Copy `decisions/TEMPLATE.md` to `decisions/<domain>/pending-<slug>.md`. The slug is the title in lower case, at most 6 words, joined by hyphens.
3. Fill the template. Leave `id: pending`. Set `status`, `date`, `tags`. The chosen option and the `Decided:` date in Evidence are fixed once written.
4. Cite the record as `[pending:<slug>]` (or `[pending:<domain>/<slug>]` when two domains share a slug) in every doc, comment or plan that names it. Never invent an id.
5. For a reversal, set `supersedes: D<4-digit id>` (for example `supersedes: D0184`) in the new record only. When it numbers the record, the bot sets `superseded-by`, `status: superseded` and the new date on the old one.
6. Run `bash scripts/check-decision-ids.sh`. It checks frontmatter, unique ids, file names and the `supersedes`/`superseded-by` pairs.
7. Add the `ready-to-merge` label to the PR. `.github/workflows/decision-ids.yml` runs `scripts/number-decisions.sh`: it takes the next id from `origin/main`, renames each pending file, sets `id`, rewrites `[pending:<slug>]` citations in the files the PR changed, and commits through the API.
8. GitHub holds the `checks.yml` run on the bot's commit for approval, because the bot authored the commit. Open the PR and click **Approve workflows to run**. The run's required `quality / decision-ledger` check runs `scripts/check-decision-ids.sh` and `scripts/check-decision-pending.sh`; the latter fails the PR while any `pending-*.md` file or `[pending:...]` citation remains.
9. After a race between 2 PRs ends in an equal id, re-add the label to the PR the uniqueness check fails; the bot renumbers its own ids.

A record's chosen option and `Decided:` date never change. Context, drivers, options, evidence, `status` and `superseded-by` may be filled in later. `decisions/context-system/D0564-decision-records-are-madr-files.md` is the rule.

## ID-gap note

Ids are non-contiguous: derive the current count and highest id with `bash scripts/decision-index.sh | tail -1` rather than trusting a number here. These 20 were never issued: `D18 D19 D29 D38 D39 D42 D43 D44 D45 D46 D47 D48 D49 D53 D54 D55 D56 D57 D58 D59`. These are numbering artifacts from the original distillation of the raw design history into this ledger (2026-07-11), not lost or deleted decisions. Do not renumber numbered decisions or try to "fill" these ids.
