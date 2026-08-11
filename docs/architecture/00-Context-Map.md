<!--
status: canonical
scope: repository-wide context routing
read-when: start of every task (via root CLAUDE.md protocol)
updated: 2026-08-11
-->
# Context Map

> **Version:** 1.7.29 (2026-08-11 — two owner-requested profile-page follow-ups: `AppModeForm.astro`'s inline `<h2>`+`<p>` heading/explanation replaced with `components/ui/InfoSection.astro`, mirroring `HandednessForm.astro`'s #84 pattern; `HandednessForm.astro`'s RIGHT/LEFT option labels gain `text-sm` so the label text never wraps to a second line inside the `flex-1` option card at narrow widths; prior 1.7.28 — 2026-08-11 — two owner-reported follow-up issues fixed: `board-input.module.ts`'s magnifier placement no longer re-decides which side of the pointer it sits on during a drag — `resolveMagnifierSide` now runs once, on press, and `clampMagnifierPlacement` (new, only repositions along the current side) runs on every `move`, so the magnifier can no longer visibly jump to the opposite side mid-gesture even though it still slides to stay on-screen (#83, `MagnifierSide` type raised to `types.ts` per the type-barrel gate); `HandednessForm.astro`'s RIGHT/LEFT options now render on one line (radiogroup wrapper `flex gap-2`, each option `flex-1`) and its title+explanation moved into `components/ui/InfoSection.astro` (moved there from `components/layout/games/setup/`, generalized to render `title` verbatim instead of baking in a " rules" suffix, with a new optional `id` prop so `HandednessForm`'s `aria-labelledby` still resolves) — `ScoreTrainingSetupForm.astro`, `InfoSection`'s other caller, updated its import path and passes `"Scoring Training rules"` explicitly to keep its rendered heading unchanged (#84); prior 1.7.27 — 2026-08-11 — PR review fix: `BoardInputPanel.astro`'s Undo/Bounce-out `<button>`s replaced with `components/forms/Button.astro` (`variant="secondary" icon` / `variant="ghost"` + `glass`), the reusable primitive this should have used from the start; `app/CLAUDE.md`/`AGENT.md`'s Style non-negotiables gain an explicit "reuse existing UI components before hand-rolling markup" rule, exempting the pre-existing `role="radio"` option-button pattern (`AppModeForm.astro`, `HandednessForm.astro`) a shared `Button` cannot express; prior 1.7.26 — four owner-reported board-UI issues fixed: `board-geometry.module.ts`'s `trebleInner` corrected 97→99mm so the treble ring is 8mm wide like the double ring (#79 — the double ring already matched the 162/170 regulation width; the outer-single/inner-single gap the issue also flagged is real-board-accurate and deliberately left alone), with `dartboard.svg`/`DartBoard.astro`'s 20×2 affected segment paths regenerated in lockstep and `board-geometry.module.test.ts`/`miss-margin.module.test.ts`'s hardcoded treble-centroid coordinates shifted to match; `BoardMagnifier.astro`'s resolved-read label gains a `glass` background for legibility (#81); `BoardInputPanel.astro`'s Undo/Bounce-out buttons reordered (Undo left, Bounce out right), sized equally (`flex-1` each) and Bounce out gains `glass` (#80); a new `boardInput` Alpine store (`stores/board-input.store.ts`, one `$persist` `handedness` field) is wired into `board-input.data.ts`'s `freshController`, replacing the `boardInput()` call's implicit `"RIGHT"` default so the magnifier opens on the player's actual throwing-hand side instead of only auto-flipping at the viewport edge, with a new profile-page `HandednessForm.astro` writing the store (#78, D206 — local `$persist` chosen over `player_settings` since this is a per-device rendering preference, not gameplay data); 501's `averageThisLeg`/`previousScoreThisLeg` renamed `average`/`previousScore` and re-scoped to read `$store.game.turns` (the whole match) instead of `turnsInCurrentLeg()`, fixing both stats resetting to zero/`—` at every leg boundary — `dartsThrownThisLeg` stays leg-scoped, which was already correct (#68); prior 1.7.25 — 2026-08-10 — owner-requested visual polish on the merged board UI: `BoardMagnifier.astro`'s resolved read now prints above the circle at `text-xs` (was below, `text-sm`) via a new pure `magnifierLabelStyle()` mirroring `magnifierAnchorStyle`/`magnifierBoardStyle` (D204, supersedes D199's layout clause); `--dartboard-*` tokens in `global.css` recoloured from the sky-blue theme to a real board's black/cream single beds and red/green multiplier rings, and `.dartboard-group .segment text` fixed to read the already-defined `--dartboard-label` token instead of `--accent` (D205, `decisions/frontend/style.md`); both verified by rendering the actual compiled component in a headless browser — the label's measured bounding box sits above the circle's, and each zone's computed `fill` matches the intended hue; prior 1.7.24 — 2026-08-10 — the engine's dead `inputMode` field is removed outright (D203, supersedes D198): the third parameter is gone from both engine constructors, `GameEngineFactory.create` and both factories, along with `engineInputMode()` and the `EngineInputMode` type; removing only the constructor parameter is what broke the build with `ts(2554)`, and `astro check` now reports 0 errors/0 warnings/0 hints where it had carried 2 permanent unused-field warnings; four tests whose sole assertion was which mode reached `factory.create` were DELETED rather than re-pointed (D148), which drops the last executable guard on D200 at that seam — D200 now lives only in `BoardInputPanel.astro`'s gate, which nothing unit-tests (D101); 35 engine tests kept their bodies with just the vanished argument dropped, and two `undo()` describe titles were re-pointed at the fact-log-shape guarantee they always tested; prior 1.7.23 — 2026-08-09 — visual board UI defect fixes from the owner's first play-through: the magnifier froze at the press position because `BoardMagnifier.astro` bound at the pure controller, whose closure-held state Alpine cannot observe — `boardInputData()` now publishes a reactive `board: BoardView` mirror re-synced after every controller call (D202); landed darts are drawn as markers via a new `DartBoard.astro` slot, showing the most recent turn's located darts so a finished visit's grouping survives until the next visit's first dart (D201); the keypad is hidden while a visual session is played and `BoardInputPanel.astro` carries its own `Undo dart`, reversing D199's keypad clause at the owner's direction; `07-Frontend/00-Overview.md` and `07-Style-Guide.md` updated with the mirror rule and the `x-for`-cannot-live-inside-`<svg>` hazard; `ScoreInput.astro` gains `{...props}` forwarding so the gate can be applied at the call site; browser-verified by driving the real Alpine build with a pointer drag — the owner's end-to-end play-through and the `v_dart_locations` query remain outstanding, no database in this container; prior 1.7.22 — 2026-08-09 — visual board UI plan 3 shipped: press-drag-release capture with a live magnifier wired into both the 501 and Score Training play pages; `board-input.module.ts` (transform/placement/state machine), `board-input.data.ts` (DOM bridge), `session-mode-resolution.ts`, `DartBoard.astro`, `BoardMagnifier.astro` and the shared `BoardInputPanel.astro` registered in File Inventory; `07-Frontend/00-Overview.md` gains a Visual Board Input section and `07-Style-Guide.md` gains pointer-tracked-surface rules (`touch-none`, `fixed` overlays, magnifier placement, the object-vs-string `:style` hazard) plus two accessibility rules; D198 (engines dispatch on input shape, not the stored mode — supersedes D189, `decisions/game-engine.md`) and D199 (press-drag-release with a magnifier over tapping, `decisions/frontend/astro.md`) appended; three defects found and fixed during execution that no unit test caught — a keypad total silently corrupting a dart row via `classify(undefined, undefined)`, `undo()` left keyed on the stored mode after `record()` moved to shape dispatch, and Alpine's string-form `:style` wiping the magnifier's `--mag-zoom`; the live play-through and `v_dart_locations` query remain owner-side, no database in this container; prior 1.7.21 — 2026-08-08 — visual board capability & settings plan 2 documented: migration chain bumped to `0001`–`0021` and seeds to `0001`–`0007` across root `CLAUDE.md`/`AGENT.md`, `database/CLAUDE.md`/`AGENT.md`/`README.md`, `docs/CLAUDE.md`/`AGENT.md`, `06-Database-Specification.md`, `10-Database-Agent-Guide.md`, `11-Neon-Integration.md`, `docs/architecture/README.md` and this file, closing the open `scripts/check-context-map.sh` gate failure recorded against `0018`; `03-Migrations.md` gains `0019`/`0020`/`0021` sections incl. the three-stage migrate→seed→migrate apply order; `06-Spec/01-Reference-Layer.md` gains `ruleset_version_capabilities`; `06-Spec/03-Player-Layer.md`'s `player_settings` moves from deferred to shipped and its two mode FKs are corrected to migration `0017`; `v_player_settings` registered in `06-Spec/05-Read-Model-Layer.md` and `05-Views.md`; `GET`/`PATCH /api/players/me/settings` contracted in `04-Endpoint-Contracts.md` →1.3.0 and routed in `00-Overview.md` →1.6.0; D195 (settings endpoints ship, supersedes D60's deferral clause, `decisions/api.md`), D196 (capability declared twice — cross-runtime constant + seeded table + composite FK — and keyed on ruleset version, `decisions/architecture.md`) and D197 (`validateConfig` must admit every mode pair its `validateBatch` handles, `decisions/game-engine.md`) appended; `player_settings endpoints` dropped from the Deferred list; capability/settings/games-filter code and the new migrations, seed and verification scripts registered in File Inventory — no real database in this container, so `0019`/`0020`/`0021` and seed `0007` ship unapplied and `app/src/db/schema.ts`'s `vPlayerSettings` block is hand-written rather than introspected, awaiting owner ratification; prior 1.7.20 — `scripts/check-context-map.sh` pins a UTF-8 locale for its migration-range check, which had been silently matching nothing under this container's POSIX locale and so reporting green while six ranges were stale; the check now also skips `decisions/**` (frozen by `scripts/check-decision-ids.sh`) and seed ranges; `0001`–`0018` corrected in root `CLAUDE.md`/`AGENT.md`, `06-Database-Specification.md`, `10-Database-Agent-Guide.md`, `11-Neon-Integration.md`; D194 (`decisions/context-system.md`) records it; prior 1.7.19 — visual board capture core plan 1 is complete: `npm run db:verify` returns `ALL 11 CHECKS PASSED` against the Neon dev branch, matching the local PostgreSQL 16 results exactly, so no operator-checklist item remains open; prior 1.7.18 — operator-checklist steps 3–5 turned into a committed, rollback-safe SQL script, `database/verification/0018_visual_board_checks.sql`, run by `npm run db:verify` (`app/scripts/verify-db.ts`) so the checks need no local `psql` — this project has no local PostgreSQL server (D24), so its client binaries are absent too; D193 (`decisions/database.md`) records why; the checklist now invokes it and records the operator's Neon migrate+seed run; prior 1.7.16 — visual board capture core verified against a real PostgreSQL 16 cluster: migration `0018`'s angle expression could never have applied (`MOD()` has no `double precision` overload), fixed in place with a `::NUMERIC` cast and guarded by `app/tests/db/migration-numeric-typing.test.ts`; `drizzle-kit introspect` run for real, confirming the hand-written `locationX`/`locationY`/`chk_dart_location_pair` and registering `v_dart_locations` in `schema.ts`; operator checklist steps 1 and 3–5 verified and the handoff rewritten to say so; D192 (`decisions/database.md`) records the run; `06-Spec/05-Read-Model-Layer.md` gains the NUMERIC-arrives-as-string note; `app/db/` (dbmate's schema dump) git-ignored; prior 1.7.15 — visual board branch rebased onto main after PR #72 merged; the branch's draft `D187` (single is two stored bands) renumbered to `D191`, main having already issued `D187` for the Alpine closure rule — `DECISIONS.md` counts and ID-gap note updated to 171 decisions, highest `D191`; prior visual board capture core plan 1, Task 15: migration range bumped to `0001`–`0018` throughout (`06-Spec/04-Runtime-Layer.md`, `06-Spec/05-Read-Model-Layer.md`, `05-Views.md`, `03-Migrations.md`, this file, `database/README.md`, `10-Database-Agent-Guide.md`, `docs/architecture/README.md`, `database/CLAUDE.md`/`AGENT.md`) closing the open `scripts/check-context-map.sh` gate failure recorded against `0017`; `06-Spec/04-Runtime-Layer.md` gains the shipped `location_x`/`location_y` shape, the ANALYTICS+VISUAL_BOARD capture-depth pairing, the QUICK_SCORE-scoped 501 bust limitation retitle + VISUAL_BOARD retirement note, and the `total_score` bust carve-out; `v_dart_locations` registered in `06-Spec/05-Read-Model-Layer.md` and `05-Views.md`; `board-geometry.module.ts`, `miss-margin.module.ts`, `visual-board.validator.ts` and seeds `0005`/`0006` registered in File Inventory; D188 (dart coordinates shipped, `decisions/database.md`) and D189 (mode-scoped bust visibility, `decisions/game-engine.md`) appended; operator handoff `docs/superpowers/handoffs/2026-08-05-visual-board-operator-checklist.md` added and registered — no real database in this container, so migrations `0017`/`0018` and seeds `0005`/`0006` ship unapplied; prior 1.7.14 — 2026-08-07 — D187: Alpine closure rule for UI module instances — an Alpine factory driving a `modules/ui/*` class keeps the instance in the factory closure, never on `this.*`, since Alpine's deep-proxied reactive state throws when an ES private field is read through the Proxy (renumbered from a draft D185 during rebase onto main, which had already taken D185/D186 for the graph-CI-ownership decisions via PR #70); Setup Toggle integration design/plan registered; `03-Alpine-Patterns.md` →0.2.3; prior 1.7.13 — D186: `graph.yml`'s PR creation is contingent on the repo's "Allow GitHub Actions to create and approve pull requests" setting, off by default; the job now degrades to a pushed `chore/graph-refresh` branch plus a run summary instead of failing, measured on the first real post-merge run; `graph.yml` File Inventory row updated; prior 1.7.12 — graph freshness moved to CI: `.github/workflows/graph.yml` + `scripts/graph-delta.py` registered in File Inventory; `graphify-out/graph.json` row updated to state it is CI-maintained (still `generated`, still never hand-edited); D185 records the decision, and the corresponding local-refresh/completion-report language dropped from root+`app` `CLAUDE.md`/`AGENT.md`, the `context-maintenance` skill, the `validate-app` skill (which still told agents to record the warning and stage the graph — it is `app/CLAUDE.md`'s named sole validation procedure, so it would have produced a fifth staleness disclosure), `app/README.md`, and this file's Knowledge graph conventions row; prior 1.7.11 — final whole-branch review fixes for the decision-ledger split: D135/D136 re-filed database.md→context-system.md (counts 12/28, deploy/Prettier/format/husky added to its `load-when` + router row); PWA/manifest/icon/safe-area added to frontend/astro.md + frontend/style.md `load-when` + router rows; "Why was X decided?" pack-row regex-skip fixed (single `~2.5k` cell, real ~2.3k–5.8k range moved to prose); Authority Order now names `decisions/**` explicitly; `01-Rendering-Strategy.md`'s stale `DECISIONS.md` citation row repointed at the 3 domain files that actually hold D79/D80/D88/D97/D98/D172; decision-ledger migration tooling (split-decisions.sh, verify-decision-split.sh, decision-map.txt, decision-front-matter.txt) registered as spent/historical; `scripts/check-decision-ids.sh` gains row-hash and registration checks (`scripts/decision-row-hashes.tsv` added); prior 1.7.10 — `scripts/check-decision-ids.sh` registered under Cross-cutting mechanical guards: durable id-integrity gate for the split ledger, position-anchored against darts `D<n>` notation; prior 1.7.9 — decision ledger split registered: `DECISIONS.md` is now a router, its 163 decisions live in 10 `decisions/**` domain files; File Inventory's single `DECISIONS.md` row replaced with 11 rows (router + 10 domain files, each with its own `~Nk`); Context Packs "Why was X decided?" row repointed at the router + only the domain file(s) a task needs; prior 1.7.8 — 501 recreational v1 spec/plan + checkout-path module registered)
>
> Single source for: what documentation exists, what each file answers, which files a task needs, and the authority order when documents conflict. Maintained under the mandatory Context Maintenance protocol in the root `CLAUDE.md`.

---

# Context Packs

Load exactly the pack for your task type. Do not preload anything else. Escalate to additional files only when the pack demonstrably lacks the answer. (Root `CLAUDE.md` invariants are always in effect and are not repeated in the packs.)

| Task type | Load exactly | ~Budget |
| --------- | ------------ | ------- |
| New table / column / constraint | `05-Database/10-Database-Agent-Guide.md`, relevant `05-Database/06-Spec/` chapter, `05-Database/03-Migrations.md` | ~6k |
| New view / analytics query | `05-Database/05-Views.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~3.9k |
| New seed data | `database/seeds/0001` or `0002` (match id ranges); `0003`/`0004` for game-type and preset-realignment precedent, `05-Database/06-Spec/01-Reference-Layer.md` | ~1.7k |
| Neon environment / tooling | `05-Database/11-Neon-Integration.md`, `app/CLAUDE.md` | ~3.5k |
| New API endpoint | `06-API/00-Overview.md`, `06-API/04-Endpoint-Contracts.md`, `app/CLAUDE.md` | ~9.9k |
| API middleware / layering change | `06-API/02-Middleware-And-Layering.md`, `06-API/03-Shared-Conventions.md`, `app/CLAUDE.md` | ~8.3k |
| Frontend page / component work | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/05-Astro-Components.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~12.7k |
| Frontend gameplay / session features | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~15.9k |
| Frontend new route / rendering | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/01-Rendering-Strategy.md`, `07-Frontend/02-Folder-Structure.md`, `app/CLAUDE.md` | ~12.1k |
| Frontend architecture / new pattern | `07-Frontend/01-Rendering-Strategy.md`, `07-Frontend/02-Folder-Structure.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/05-Astro-Components.md`, `04-Architecture-patterns.md`, `01-Principles.md` | ~17k |
| New portable UI primitive | `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~10.4k |
| New test / test-strategy question | `07-Frontend/06-Test-Strategy.md`, `app/CLAUDE.md` | ~2.9k |
| New game type | `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", `06-Spec/01-Reference-Layer.md`, `06-Spec/02-Template-Layer.md`, seeds | ~5.9k |
| New game engine | `04-Architecture-patterns.md` §Pattern 18, `07-Frontend/04-Modules-And-OOP.md`, `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", the game's `docs/game-rules/rulesets/` doc | ~8k |
| Architecture question / new pattern | `01-Principles.md`, `04-Architecture-patterns.md` | ~5.7k |
| Workflow / process question | `03-Engineering-Workflow.md` | ~2.2k |
| "Why was X decided?" | `DECISIONS.md` (router — Source key, routing table, Deferred list, how-to-add-a-decision); then load only the domain file(s) your task needs from its routing table, e.g. `decisions/database.md`; deeper lineage: git history. Actual per-task total varies with domain (router + testing.md, the smallest, runs ~2.3k; router + game-engine.md, the largest, runs ~5.8k) — the single figure in the last column below prices only the router + the one example file named above. | ~3.7k |
| Bug in migration chain | `05-Database/03-Migrations.md`, full chain `database/migrations/0001`–`0021`; never patch applied files | ~4.3k |

Paths are relative to `docs/architecture/` unless they start with `docs/`, `database/`, or `app/`.

For "New game type" tasks, also check `docs/game-rules/rulesets/<game>.md` if a raw ruleset note exists for that game — optional human-authored input, not part of the fixed budget above. See "Non-Canonical Source Material" below.

---

# Authority Order (single source)

When documents conflict, higher wins; correct the lower one:

1. User instructions in the current task
2. `01-Principles.md`
3. `02-System-Architecture.md`
4. `04-Architecture-patterns.md`
5. `05-Database/06-Database-Specification.md` (+ its `06-Spec/` chapters)
6. `06-API/00-Overview.md`
7. `03-Engineering-Workflow.md`
8. SQL migrations `0001`–`0021` and seeds
9. Application code in `app/`

If code contradicts architecture docs, the docs win unless the user explicitly directs otherwise. Git history (the retired master context) and the decision ledger (`DECISIONS.md` the router, `decisions/**` the domain files it routes to) are context, never authority — they explain *why*, they never state *what is*, and rank below every numbered item above.

---

# File Inventory

Status: **canonical** = current truth · **historical** = preserved record, never read by default · **generated** = tool output, do not hand-edit.

## Foundation (`docs/architecture/`)

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `README.md` | Documentation philosophy and hierarchy | canonical | ~1.5k |
| `00-Context-Map.md` | This file — routing, packs, authority | canonical | ~15k |
| `01-Principles.md` | What we believe (core values + decision priorities) | canonical | ~2.1k |
| `02-System-Architecture.md` | System layers, data flows, ownership | canonical | ~1.9k |
| `03-Engineering-Workflow.md` | 10-phase change lifecycle | canonical | ~2.2k |
| `04-Architecture-patterns.md` | Recurring design patterns + anti-patterns; Pattern 18 game engine contract, incl. undo depth, derived-value returns and `completedAt` timing (2026-07-26) | canonical | ~3.7k |
## Database handbook (`05-Database/`)

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `00-OVERVIEW.md` | Database philosophy and operating model | canonical | ~2.5k |
| `01-Naming-Conventions.md` | Table/index/constraint/view naming | canonical | ~2.3k |
| `02-Design-Rules.md` | Schema design rules, controlled denormalisation | canonical | ~2.4k |
| `03-Migrations.md` | Migration process + chain `0001`–`0021`; `0019`/`0020` capability table + composite FK and their migrate→seed→migrate apply order, `0021` `v_player_settings` (2026-08-08) | canonical | ~4.3k |
| `04-Indexes.md` | Index strategy (query-path driven) | canonical | ~2.6k |
| `05-Views.md` | View categories and replay rules; eight implemented views through `0021` (2026-08-08) | canonical | ~2.2k |
| `06-Database-Specification.md` | Cross-layer invariants + index into `06-Spec/` chapters | canonical | ~2.2k |
| `06-Spec/01-Reference-Layer.md` | Lookup tables (game_types … duration_types); `ruleset_version_capabilities` and why capability is keyed on ruleset version (2026-08-08) | canonical | ~2.1k |
| `06-Spec/02-Template-Layer.md` | Templates, routines, configuration presets | canonical | ~1.6k |
| `06-Spec/03-Player-Layer.md` | players, player_settings — settings shipped, read through `v_player_settings`, capture/input mode FKs added by `0017` (2026-08-08) | canonical | ~0.8k |
| `06-Spec/04-Runtime-Layer.md` | Activities, sessions, stages, turns, darts, idempotency; turn/dart score semantics, `location_x`/`location_y` shipped, VISUAL_BOARD capture depth, QUICK_SCORE-scoped 501 bust limitation + `total_score` bust carve-out (2026-08-05) | canonical | ~3.9k |
| `06-Spec/05-Read-Model-Layer.md` | View contracts (`v_*`), incl. `v_dart_locations` (2026-08-05) and `v_player_settings` (2026-08-08) | canonical | ~2.3k |
| `06-Spec/06-Relationships-and-Evolution.md` | Relationship matrix, full ERD, future expansion | canonical | ~1.7k |
| `07-Data-Model-Review.md` | Design-gate record (superseded decisions inside) | historical | ~2.3k |
| `08-Physical-Schema-Mapping.md` | Design-gate record | historical | ~2.2k |
| `09-Pre-Implementation-Review.md` | Design-gate record | historical | ~1.5k |
| `10-Database-Agent-Guide.md` | Condensed DB rules for agents; ID strategy owner; new-game-type checklist through engine registration (2026-07-26) | canonical | ~2.6k |
| `11-Neon-Integration.md` | Neon topology, branches, dbmate/drizzle workflow; `env:dev`/`env:prod` PUBLIC_ mirror; per-branch trusted origins (D172, 2026-07-29) | canonical | ~1.6k |

## API (`06-API/`) and Frontend (`07-Frontend/`)

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `06-API/00-Overview.md` | Frozen v1 API baseline: runtime, routes, auth, envelopes; `/api/auth/*` same-origin proxy (D172, 2026-07-29); `/api/players/me/settings` routed (D195, 2026-08-08) | canonical | ~2.8k |
| `06-API/01-Implementation-Strategy.md` | REST endpoints, Cloudflare + Neon constraints | canonical | ~2.1k |
| `06-API/02-Middleware-And-Layering.md` | Middleware, `locals.auth`, folder layering, API error boundary; `api-auth-proxy` route class (D172, 2026-07-29) | canonical | ~3.0k |
| `06-API/03-Shared-Conventions.md` | Envelope, headers, pagination, error registry; type-raising governs type imports, value imports exempt (2026-07-26) | canonical | ~4k |
| `06-API/04-Endpoint-Contracts.md` | Per-domain endpoint contracts (2026-07-22); Player Settings `GET`/`PATCH /api/players/me/settings` incl. the uncapable-pair `VALIDATION_FAILED` case (D195, 2026-08-08) | canonical | ~5.7k |
| `07-Frontend/00-Overview.md` | Client integration, state ownership, handbook index (2026-07-17) | canonical | ~3.4k |
| `07-Frontend/01-Rendering-Strategy.md` | Prerender-default, middleware, client auth gate (D98), route classes; same-origin auth client (D172, 2026-07-29) | canonical | ~2.2k |
| `07-Frontend/02-Folder-Structure.md` | `app/src/` tree, aliases, suffixes; cross-runtime `lib/game/rulesets/` (2026-07-26) | canonical | ~1.9k |
| `07-Frontend/03-Alpine-Patterns.md` | Alpine factory, stores, forms, `$persist` (D120 per-field factory), recovery/hard-gate; UI module instances held off the reactive object (D187, 2026-08-07) | canonical | ~3.2k |
| `07-Frontend/04-Modules-And-OOP.md` | OOP boundary, portable UI kit, `GameEngine` contract members (derived-value returns, undo depth) + engine anti-patterns (2026-07-26) | canonical | ~1.9k |
| `07-Frontend/05-Astro-Components.md` | `.astro` authoring: frontmatter order, props, class composition, slots; template `{/* */}` comments; Prettier `singleAttributePerLine` (2026-07-21) | canonical | ~2.1k |
| `07-Frontend/06-Test-Strategy.md` | Shared-mock promotion rule, full-suite-always-runs policy (2026-07-16) | canonical | ~0.7k |
| `07-Frontend/07-Style-Guide.md` | Sky/glass/surface visual contract: tokens, primitives, typography, motion, a11y; Tailwind v4 utility syntax section — suffix `!important`, arbitrary negatives (D175, 2026-07-31); top safe-area inset noted alongside `h-dvh` (D174, 2026-07-29) | canonical | ~3.7k |
| `07-Frontend/10-Frontend-Agent-Guide.md` | Condensed frontend agent rules; comment/format checklist; TS JSDoc-above convention (2026-07-21) | canonical | ~2.1k |

## SQL (`database/`)

| File | Answers | Status |
| ---- | ------- | ------ |
| `README.md` | Directory layout, apply order | canonical |
| `migrations/0001`–`0021` | Applied schema chain — never modify | canonical (applied) |
| `seeds/0001`, `0002` | Reference data + default templates | canonical |
| `database/seeds/0003_game_engine_reference.sql` | `BOBS27` + `DOUBLES_TRAINING` game types, features, ruleset versions, presets (2026-07-26) | canonical |
| `database/seeds/0004_score_training_minutes_preset.sql` | Score Training minutes preset realigned to 5 (2026-07-31) | canonical |
| `database/seeds/0005_visual_board_input_mode.sql` | `VISUAL_BOARD` input mode (2026-08-05) | canonical |
| `database/seeds/0006_single_band_dart_zones.sql` | `INNER_SINGLE` (id 7) / `OUTER_SINGLE` (id 8) dart zones (D191, 2026-08-05) | canonical |
| `database/seeds/0007_ruleset_version_capabilities.sql` | The 8 declared ruleset-version/capture-mode/input-mode triples, mirroring `capabilities.ts`; must run before migration `0020` (D196, 2026-08-08) | canonical |
| `database/verification/0018_visual_board_checks.sql` | Rollback-safe live-database checks for the visual-board capture core: `chk_dart_location_pair`, `v_dart_locations` angles, bust divergence; run via `npm run db:verify` (D193, 2026-08-08) | canonical |
| `database/verification/0007_capability_seed_checks.sql` | Seed `0007` row count, per-triple resolution, zero undeclared `exercise_sessions` (the `0020` precondition — read its `undeclared`/`total` detail, an empty table passes trivially), parity with `capabilities.ts` (12 checks) (D196, 2026-08-08) | canonical |
| `database/verification/0020_capability_fk_checks.sql` | `fk_sessions_capability` exists over the exact composite columns, refuses an undeclared mode combination, permits a declared one (4 checks) (D196, 2026-08-08) | canonical |
| `database/verification/0021_player_settings_checks.sql` | `v_player_settings` column set, id→key translation, no row for a player with no settings, `LEFT JOIN` preserved under NULL mode ids (7 checks) (D195, 2026-08-08) | canonical |

## Game engine code + mechanical guards

Registered for discoverability, not as reading material — the rules live in `04-Architecture-patterns.md` Pattern 18 and `07-Frontend/04-Modules-And-OOP.md`. (2026-07-26)

| File | Answers | Status |
| ---- | ------- | ------ |
| `app/src/lib/game/rulesets/types.ts` | One `.strict()` Zod config schema per ruleset version (cross-runtime) | canonical |
| `app/src/lib/game/rulesets/config-codec.ts` | snake_case wire config ↔ camelCase client snapshot | canonical |
| `app/src/lib/game/rulesets/refinement-contract.ts` | Declared accept/reject boundaries every schema refinement must hold | canonical |
| `app/src/lib/game/rulesets/capabilities.ts` | `RULESET_CAPABILITIES` + `supportsMode` / `capableRulesets` — the cross-runtime code-side declaration of which capture/input mode pairs each ruleset version implements; mirrored by seed `0007` (D196, 2026-08-08) | canonical |
| `app/src/lib/game/rulesets/games-visibility.ts` | Filters `GameCardDescriptor`s by the player's app mode via `supportsMode`; drives the games page's cards, banner and empty state (2026-08-08) | canonical |
| `app/src/lib/game/games-index.data.ts` | `GAME_CARDS` — the games-page card list the visibility filter is applied to (2026-08-08) | canonical |
| `app/src/modules/game/interfaces.ts` | `GameEngine` / `GameEngineFactory` — the contract itself | canonical |
| `app/src/modules/game/engine.registry.ts` | `rulesetVersionKey` → engine factory lookup | canonical |
| `app/src/modules/game/board-progression.module.ts` | Shared board paths and dartboard arithmetic | canonical |
| `app/src/modules/game/client-key.module.ts` | `newClientKey()` — transient batch correlation token, explicitly not an entity id (D190) (2026-08-05) | canonical |
| `app/src/modules/game/checkout-path.module.ts` | Standard 2-170 double-out checkout chart; `null` for bogey numbers (2026-08-01) | canonical |
| `app/src/modules/game/events.payload.module.ts` | The one `buildEventsBatch` for every game | canonical |
| `app/src/modules/game/tuod.engine.module.ts` | Ten Up One Down: the checkout ladder folded from attempt turns (2026-07-26) | canonical |
| `app/src/lib/game/board/board-geometry.module.ts` | Regulation board radii, clockwise sector order, `classify(x, y)` → `BoardHit` (target/zone/score), `zoneCentroid`; `trebleInner` corrected 97→99mm so the treble ring is 8mm wide like the double ring (2026-08-05; radius fix 2026-08-11) | canonical |
| `app/src/lib/game/board/miss-margin.module.ts` | Distance + bearing from a dart's landing point to its declared zone's centroid; deliberately outside SQL — see `v_dart_locations` (2026-08-05) | canonical |
| `app/src/modules/game/board-input.module.ts` | Visual board input, pure: `screenToBoard` (viewport px → board mm via the SVG's inverse screen CTM), `boardPxPerMm`, `resolveMagnifierSide`/`clampMagnifierPlacement` (handedness+edge-flip side resolved once per gesture on press, clamped per move so it never swaps sides mid-drag — #83, 2026-08-11), `magnifierPlacement` (single-call wrapper of both, D199, 2026-08-09), `boardInput` press-drag-release state machine | canonical |
| `app/src/lib/game/board-input.data.ts` | Alpine/DOM bridge for the board: pointer events → controller, a fresh controller per press so a resize or rotation between gestures is picked up; reads `$store.boardInput.handedness` into each fresh controller (D206, 2026-08-11) | canonical |
| `app/src/stores/board-input.store.ts` | `boardInput` Alpine store: one `$persist` `handedness` field, local-only rather than routed through `player_settings` (D206, 2026-08-11) | canonical |
| `app/src/lib/game/session-mode-resolution.ts` | `resolveSessionModePair` (player settings + ruleset capability → the pair a new session is created with) and `startSessionInput` (the store payload both setup pages send), shared by both play pages (2026-08-10) | canonical |
| `app/src/components/ui/DartBoard.astro` | Presentational dartboard SVG, millimetre `viewBox`, `role="img"` + `aria-label`; optional `boardRef` opts one instance into the controller's `x-ref` (2026-08-09) | canonical |
| `app/src/components/ui/BoardMagnifier.astro` | Zoomed inset following the fingertip: a second clipped `DartBoard`, crosshair, live resolved read with a `glass` background for legibility; `aria-hidden`, `fixed`, zoom scaled to the displayed board (D199, 2026-08-09; glass label 2026-08-11) | canonical |
| `app/src/components/ui/InfoSection.astro` | Collapsible info panel (heading + chevron-toggled description); `title` rendered verbatim, optional `id` for a caller's `aria-labelledby`; moved from `components/layout/games/setup/` so `HandednessForm.astro` can reuse it outside the games domain (#84, 2026-08-11) | canonical |
| `app/src/components/layout/games/BoardInputPanel.astro` | The board block both play pages mount: mode gate, `touch-none` pointer surface, magnifier `x-if` guard, equal-size Undo (left) / `glass` Bounce out (right) actions built from `components/forms/Button.astro`; declares no `x-data` of its own (2026-08-09; button layout 2026-08-11; Button.astro reuse 2026-08-11) | canonical |
| `app/src/components/forms/HandednessForm.astro` | Profile-page throwing-hand picker — roving-tabindex radiogroup writing `$store.boardInput.handedness` directly; title/explanation moved into `components/ui/InfoSection.astro`, RIGHT/LEFT options laid out on one line (`flex` row, `flex-1` each, `text-sm` label so the option text never wraps) (D206, 2026-08-11; single-line + InfoSection reuse #84, 2026-08-11) | canonical |
| `app/src/services/rulesets/quick-score.validator.ts` | Shared RECREATIONAL + QUICK_SCORE batch rules (no dart rows, turn-total bound, ROUNDS attempt cap) (2026-07-26) | canonical |
| `app/src/services/rulesets/tuod/tuod.validator.ts` | `TUOD_V1` config + batch validation, ladder-derived turn-total bound (2026-07-26) | canonical |
| `app/src/services/rulesets/visual-board.validator.ts` | Re-derives every ANALYTICS + VISUAL_BOARD dart from its coordinate via `classify()`, refuses a batch that disagrees; `isVisualBoardCapture` predicate shared with the engines (2026-08-05) | canonical |
| `scripts/check-game-engines.sh` | Guard: every engine exports a factory, registers it, and has a validator | canonical |
| `scripts/check-refinement-coverage.sh` | Guard: refinements in `types.ts` match the refinement contract; blind spots documented in its header | canonical |
| `scripts/check-type-barrels.sh` | Guard: no inline exported `type`/`interface` in implementation files, every `types.ts`/`interfaces.ts` raised by its parent, no aliased or relative barrel **type** import deeper than the importing file's own folder or the area root (value imports exempt, D156); blind spots documented in its header (2026-07-26) | canonical |

## Player settings and app mode (2026-08-08)

Registered for discoverability, not as reading material — the contract lives in `06-API/04-Endpoint-Contracts.md` §Player Settings and the rationale in D195/D196.

| File | Answers | Status |
| ---- | ------- | ------ |
| `app/src/services/settings.service.ts` | `readSettings` / `writeSettings` — quick-score fallback for a player with no row, and the `capableRulesets` guard that refuses an uncapable mode pair; returns `ServiceResult`, never throws (D195) | canonical |
| `app/src/repositories/settings.repository.ts` | `findSettings` reads `v_player_settings`; `upsertSettings` writes `player_settings`, resolving mode keys to ids and creating the row lazily (D195) | canonical |
| `app/src/pages/api/players/me/settings.ts` | `GET`/`PATCH` route handlers over that service, in the frozen `ok`/`fail` envelope (D195) | canonical |
| `app/src/lib/client/api/settings.ts` | Browser client for the settings pair, following the sibling API clients' auth handling | canonical |
| `app/src/stores/settings.store.ts` | Alpine store holding the player's app mode, registered in `register-stores.ts`; optimistic save with rollback | canonical |
| `app/src/components/forms/AppModeForm.astro` | Profile-page mode picker — roving-tabindex radiogroup with a non-colour selection cue; title/explanation moved into `components/ui/InfoSection.astro` (2026-08-11) | canonical |

## Cross-cutting mechanical guards (2026-07-28)

Guards not specific to the game-engine contract, registered here for discoverability.

| File | Answers | Status |
| ---- | ------- | ------ |
| `scripts/check-alias-sync.sh` | Guard: `tsconfig.json` compilerOptions.paths and `vitest.config.ts` resolve.alias never diverge (D113); `@styles` allowlisted as TS-only | canonical |
| `scripts/check-constraint-mirror.sh` | Guard: every live CHECK constraint on `exercise_stages`/`turns`/`darts` has a `// MIRRORS: chk_x` anchor in `app/src/pages/api/sessions/types.ts` (D149); bound agreement executed in `constraint-mirror.test.ts`, not by this script | canonical |
| `scripts/check-no-inline-comments.sh` | Guard: no `//` or non-JSDoc `/* */` comment inside a function/method body under `app/src/**/*.ts`; JSDoc `/** */` above a declaration stays exempt | canonical |
| `scripts/check-style-tokens.sh` | Guard: no `font-medium`, `{...rest}`, raw `bg-bg*`/`text-fg*`, Tailwind prefix-important (`!utility`), or leading-dash arbitrary (`-prop-[…]`) under `app/src/**/*.{astro,css}` | canonical |
| `scripts/check-file-locations.sh` | Guard: no `.ts` files directly under `components/`/`pages/` except `pages/api/**` | canonical |
| `scripts/check-agent-mirrors.sh` | Guard: every `CLAUDE.md` has a byte-identical `AGENT.md` sibling | canonical |
| `scripts/check-astro-class-composition.sh` | Guard: no `class:list` or manual class-join in `app/src/**/*.astro`; `cn()` only | canonical |
| `scripts/check-astro-conventions.sh` | Guard: every `x-show` has `x-cloak`; no HTML comments in `.astro` template regions | canonical |
| `scripts/check-context-map.sh` | Guard: every path referenced from a CLAUDE.md/README.md/context map exists; migration-range claims agree with `database/migrations/` (2026-07-23) | canonical |
| `scripts/check-doc-links.sh` | Guard: markdown links and path-like backtick refs across the canonical doc set resolve (D133) | canonical |
| `scripts/check-context-budget.sh` | Guard: this file's own `~Nk` token estimates don't drift from a chars/4 estimate (D133) | canonical |
| `scripts/check-decision-ids.sh` | Guard: every id across `decisions/**` is unique, none of the 163-id 2026-08-02 baseline has disappeared, every `Supersedes:` target exists, `DECISIONS.md` stays a router, every migrated row still hash-matches `scripts/decision-row-hashes.tsv` (D184+ out of scope by design), every `decisions/**.md` file is registered in the router's routing table; position-anchored to avoid darts `D18`/`D20` notation; blind spots documented in its header (2026-08-02; hash + registration checks 2026-08-03) | canonical |
| `scripts/decision-row-hashes.tsv` | Data file: id → sha256 of the 163 migrated rows' exact text at the 2026-08-02 split, read by `scripts/check-decision-ids.sh`'s row-integrity check | canonical |

## Brand asset generators (2026-07-31)

Registered for discoverability — regenerate committed outputs via `npm run icons:generate` / `npm run logo:generate` in `app/`.

| File | Answers | Status |
| ---- | ------- | ------ |
| `app/scripts/generate-app-icons.ts` | Regenerate PWA/favicon PNGs + `favicon.svg`/`favicon.ico` from `bg-dartboard.svg` (`npm run icons:generate`) (2026-07-31) | canonical |
| `app/scripts/generate-logo-lockup.ts` | Regenerate outlined `logo-lockup.svg` lockup from Michroma outlines (`npm run logo:generate`) (2026-07-31) | canonical |

## Decision ledger (repo root, `decisions/`) (2026-08-02)

`DECISIONS.md` routes to these; it holds no decision rows itself. Load-when lists mirror the router's own routing table — don't re-derive them here.

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `DECISIONS.md` | Router: authority note, Source key, routing table, Deferred list, facts-vs-decisions rule, how-to-add-a-decision (2026-08-02) | canonical | ~1.7k |
| `decisions/architecture.md` | 20 decisions — domain model, activity, session, stage, turn, dart, ruleset, platform, dart zones, client keys, mode capability | canonical | ~2.1k |
| `decisions/database.md` | 15 decisions — schema, migration, table, column, constraint, index, view, Neon, seed | canonical | ~2k |
| `decisions/api.md` | 30 decisions — endpoint, contract, envelope, auth, middleware, idempotency, batch, Worker, player settings | canonical | ~2.6k |
| `decisions/game-engine.md` | 29 decisions — engine, GameEngine, ruleset, scoring, checkout, fact log, 501, Score Training | canonical | ~5.7k |
| `decisions/testing.md` | 5 decisions — test, TDD, Vitest, mock, coverage | canonical | ~0.6k |
| `decisions/frontend/architecture.md` | 15 decisions — layering, folder structure, suffix, barrel, type import, error mapping, API client | canonical | ~2k |
| `decisions/frontend/astro.md` | 18 decisions — .astro, component, prerender, routing, layout, cn(), props, frontmatter, PWA, manifest, icon, safe-area | canonical | ~3.0k |
| `decisions/frontend/alpine.md` | 13 decisions — Alpine, stores, state, persist, recovery, x-data, x-show | canonical | ~1.5k |
| `decisions/frontend/style.md` | 9 decisions — style, CSS, token, Tailwind, primitive, typography, spacing, glass, surface, PWA, manifest, icon, safe-area | canonical | ~1.3k |
| `decisions/context-system.md` | 31 decisions — docs, context map, CLAUDE.md, skill, gate, check script, knowledge graph, CI, deploy, Prettier, format, husky | canonical | ~4.1k |

### Decision ledger migration tooling (2026-08-02, spent — 2026-08-03)

Registered for discoverability and provenance, not as reading material: `scripts/split-decisions.sh` ran once (2026-08-02) to produce the `decisions/**` tree above and now hard-fails if re-run (the ledger it reads from holds zero rows); `scripts/verify-decision-split.sh` proves that one run was lossless against an ephemeral `/tmp` snapshot and legitimately SKIPs once that snapshot is gone; `scripts/decision-map.txt` and `scripts/decision-front-matter.txt` were that run's inputs. None of the four is the ongoing guard — `scripts/check-decision-ids.sh` (registered under Cross-cutting mechanical guards below) is.

| File | Answers | Status |
| ---- | ------- | ------ |
| `scripts/split-decisions.sh` | Spent one-shot migration script: wrote `decisions/**` from `DECISIONS.md` + the map + the front-matter sidecar (2026-08-02) | historical |
| `scripts/verify-decision-split.sh` | Spent one-shot verifier: proves that migration was lossless against a `/tmp` snapshot (SKIPs once the snapshot is gone) | historical |
| `scripts/decision-map.txt` | Spent migration input: id → target-file assignment as it stood at the 2026-08-02 split | historical |
| `scripts/decision-front-matter.txt` | Spent migration input: per-target-file front-matter blocks as they stood at the 2026-08-02 split | historical |

## Context & history (repo root, `docs/`)

| File | Answers | Status |
| ---- | ------- | ------ |
| `README.md` | Repo orientation: project summary, folder layout, getting started (2026-07-14) | canonical |
| `.github/pull_request_template.md` | Default PR description scaffold + architecture checklist (2026-07-12) | canonical |
| `docs/CLAUDE.md` | Docs-tree editing rules | canonical |
| `docs/superpowers/{specs,plans,handoffs}/` | Point-in-time task designs and plans | historical |
| `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` | Game engine PR review: findings C1/C2, I1–I8, M1–M6, P1–P4, ST1–ST7 — closed except **P1** (branch carries no PR against `main` yet — pending this task's completion) and **P3** (knowledge graph stale; `graphify` CLI absent in this environment); other resolutions are canonical in Pattern 18, `07-Frontend/04-Modules-And-OOP.md`, `06-Spec/04-Runtime-Layer.md` and `DECISIONS.md` D138–D144 (2026-07-26) | historical |
| `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` | The 14-task plan closing the findings; P1 and P3 remain open as of Task 14 (2026-07-26) | historical |
| `docs/superpowers/specs/2026-07-29-ios-web-app-auth-design.md` | iOS Home Screen web app auth: same-origin `/api/auth/*` proxy design, cookie-rebinding rules, PWA manifest scope (D172, D173) (2026-07-29) | historical |
| `docs/superpowers/plans/2026-07-29-ios-web-app-auth.md` | The 9-task plan implementing that spec, incl. the Neon Auth trusted-origin prerequisite (2026-07-29) | historical |
| `docs/superpowers/handoffs/2026-07-29-ios-auth-pre-merge-checklist.md` | Operator checklist: manual Neon-console trusted-origin registration + iOS Safari verification, neither doable in-session (2026-07-29) | historical |
| `docs/superpowers/specs/2026-07-29-ios-safe-area-top-inset-design.md` | iOS standalone web app top safe-area inset fix: `body` pads `env(safe-area-inset-top)` alongside existing `h-dvh`/`overflow-hidden` (D174) (2026-07-29) | historical |
| `docs/superpowers/plans/2026-07-29-ios-safe-area-top-inset.md` | The 2-task plan implementing that spec, incl. the manual iOS verification handoff (2026-07-29) | historical |
| `docs/superpowers/handoffs/2026-07-29-ios-safe-area-verification-checklist.md` | Operator checklist: manual iOS-device verification of the safe-area fix, not doable in-session (2026-07-29) | historical |
| `docs/superpowers/specs/2026-07-31-tailwind-v4-utility-syntax-gate-design.md` | Tailwind v4 utility syntax gate design: ban prefix-important (`!utility`) and leading-dash arbitrary negatives (`-prop-[…]`) in favor of `utility!` / `prop-[-…]` (D175) (2026-07-31) | historical |
| `docs/superpowers/plans/2026-07-31-tailwind-v4-utility-syntax-gate.md` | The task plan implementing that spec: `scripts/check-style-tokens.sh` extension + Style Guide/agent-guide/mirror/context-map/decision updates (2026-07-31) | historical |
| `docs/superpowers/specs/2026-07-31-logo-lockup-svg-design.md` | Outlined logo lockup SVG design: Michroma outlines, generator script, home/login adoption (2026-07-31) | historical |
| `docs/superpowers/plans/2026-07-31-brand-lockup-and-app-icons.md` | The 5-task plan: dartboard favicon/PWA icons, BaseLayout links, logo-lockup generator + UI swap, context touch-up (2026-07-31) | historical |
| `docs/superpowers/specs/2026-08-01-501-recreational-v1-design.md` | 501 recreational v1 design: setup/play flow mirroring Score Training, double-out confirm gate, checkout-path lookup, leg-scoped progress stats (2026-08-01) | historical |
| `docs/superpowers/plans/2026-08-01-501-recreational-v1.md` | The 10-task plan implementing that spec: checkout-path module, shared-component reuse fixes, setup/play data factories, play UI, validation pass (2026-08-01) | historical |
| `docs/superpowers/specs/2026-08-07-setup-toggle-integration-design.md` | Setup Toggle integration design: `modules/ui` Toggle class, closure-held Alpine factory, `x-model`/`x-modelable` binding to `scoreTrainingSetup` (2026-08-07) | historical |
| `docs/superpowers/plans/2026-08-07-setup-toggle-integration.md` | The 4-task plan implementing that spec: Toggle module + types barrel, `lib/ui` Alpine factory, setup form/`$watch`/submit wiring, docs + verification (2026-08-07) | historical |
| `docs/superpowers/specs/2026-08-05-visual-board-input-design.md` | Visual board input design: tap-to-throw capture, shared `classify(x, y)` geometry, spatial facts goal, split into three plans (2026-08-05) | historical |
| `docs/superpowers/plans/2026-08-05-visual-board-capture-core.md` | Plan 1 (this branch, complete): board-geometry/miss-margin modules, migrations `0017`/`0018`, seeds `0005`/`0006`, `INNER_SINGLE`/`OUTER_SINGLE` bands (D191), both engines' visual paths, `v_dart_locations` (2026-08-05) | historical |
| `docs/superpowers/plans/2026-08-05-visual-board-capability-and-settings.md` | Plan 2 (this branch, complete): capability constant + table + seed + composite FK, registry/session-creation guards, `v_player_settings`, settings endpoints/client/store, profile `AppModeForm`, games-page mode filter; executed with three corrections — the DETAILED_DARTS rulesets are RECREATIONAL not ANALYTICS, the settings service returns `ServiceResult` instead of throwing, and an unplanned task 6b widened `validateConfig` (D197) (2026-08-08) | historical |
| `docs/superpowers/plans/2026-08-05-visual-board-ui.md` | Plan 3 (this branch, complete): screen-to-millimetre transform, magnifier placement, press-drag-release state machine, `DartBoard`/`BoardMagnifier`/`BoardInputPanel`, the Alpine bridge, both play pages, a11y + docs; executed with four unplanned corrections — a parity guard for the inlined SVG copy (4b), setup pages that hardcoded the mode pair (7b), shape-based `record()` dispatch (7c) and the matching `undo()` (7d) (2026-08-09) | historical |
| `docs/superpowers/handoffs/2026-08-05-visual-board-operator-checklist.md` | Operator checklist: apply migrations `0017`/`0018` + seeds `0005`/`0006`, `drizzle-kit introspect` diff against the hand-written `schema.ts` coordinate columns, `chk_dart_location_pair` rejection check, `v_dart_locations` angle-convention check, bust-vs-scoreless divergence check — none doable in-session, no database in this environment (2026-08-05) | historical |
| `app/CLAUDE.md` (+ `app/src/**/CLAUDE.md`) | App implementation rules, validation procedure; mid-task fallow/`npm run check` gate; Prettier pre-PR gate after writing-plans execution (2026-07-22) | canonical |
| `app/DEPLOYMENT.md` | Cloudflare Worker deploy guide: Neon prod setup, Worker secrets, GitHub Actions deploy vars, rollback, troubleshooting; `PUBLIC_NEON_AUTH_BASE_URL` no longer read by app code post-D172 (2026-07-29) | canonical |
| `AGENT.md` (repo root, `app/`, `app/src/db/`, `app/src/pages/api/`, `database/`, `docs/`) | Exact mirror of the sibling `CLAUDE.md` in the same directory, for agent tools that read `AGENT.md` instead of `CLAUDE.md`; edit both together (2026-07-15) | canonical |
| `.claude/skills/graphify/SKILL.md` | Graphify skill — build/query the codebase knowledge graph | canonical |
| `.claude/skills/context-maintenance/SKILL.md` | Context Maintenance 8-step procedure, invoked before claiming any task done (2026-07-28) | canonical |
| `.claude/skills/validate-app/SKILL.md` | `validate:app` sequence + mid-task gate condition for `app/` changes (2026-07-28) | canonical |
| `.claude/skills/run-all-gates/SKILL.md` | Dispatches the right `check-*.sh` scripts by changed area, reports each result explicitly (2026-07-28) | canonical |
| `.github/workflows/graph.yml` | CI-owned graph freshness: rebuilds `graphify-out/graph.json` (`GRAPH_REFRESH_STRICT=1`) on every push to `main`, then commits to `chore/graph-refresh` and opens/updates a PR with the delta — PR creation needs *Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"*; without it the branch is still pushed and the run summary carries a compare link (D186). On pull requests, posts a non-blocking delta comment via `scripts/graph-delta.py` without committing (2026-08-03; D186 2026-08-05) | canonical |
| `scripts/graph-delta.py` | Read-only helper: diffs two `graph.json` snapshots' node/link counts, normalising the volatile `built_at_commit` field away, for `graph.yml`'s PR body and delta comment | canonical |
| `graphify-out/graph.json` | Committed AST-only knowledge graph — CI-maintained (`.github/workflows/graph.yml` rebuilds on merge to `main`; local `scripts/refresh-graph.sh` remains available but is optional); generated, never hand-edited (2026-08-03) | generated |

---

# Non-Canonical Source Material

`docs/game-rules/` holds raw, pre-spec, human-authored game/routine/trivia rule descriptions — entry point `docs/game-rules/README.md` (2026-07-16). This tree is deliberately **not** registered in the File Inventory above and carries no `status:` front-matter requirement: `scripts/check-context-map.sh` only enforces those rules for `docs/architecture/` and `database/`. See `docs/game-rules/README.md` for the per-subfolder translation targets.

---

# Current Implementation State

| Area | Status |
| ---- | ------ |
| Domain model v1.0 | Frozen |
| Migrations | `0001`–`0021` complete; `0015` time-semantics constraints, `0016` replay/overview rebuild + `v_configuration_presets` (2026-07-13); `0017` dart location columns (`chk_dart_location_pair`) + two `player_settings` FKs, `0018` `v_dart_locations` (2026-08-05); `0019` `ruleset_version_capabilities`, `0020` `fk_sessions_capability` (needs seed `0007` first — apply order is migrate→seed→migrate), `0021` `v_player_settings` (D195/D196, 2026-08-08). `0019`–`0021` and seed `0007` ship **unapplied** — no database in this container |
| Seeds | `0001` reference data, `0002` default templates (Singles/501 presets corrected to V1 scope; both TUOD presets verified against `TuodConfig` — unchanged), `0003` `BOBS27` + `DOUBLES_TRAINING` reference data (2026-07-26), `0004` Score Training minutes preset realigned to 5 (2026-07-31), `0005` `VISUAL_BOARD` input mode, `0006` `INNER_SINGLE`/`OUTER_SINGLE` dart zones (D191, 2026-08-05), `0007` the 8 ruleset-version capability triples (D196, 2026-08-08) |
| Game engines | All six (Score Training, Bob's 27, Singles Training, Doubles Training, 501, Ten Up One Down) on the `GameEngine` contract (D138–D141, D153): config-driven, fact-log-owning, rehydratable; six ruleset validators registered; guarded by `scripts/check-game-engines.sh` (which also asserts every registered engine declares a capability) + `scripts/check-refinement-coverage.sh`. Each ruleset version's supported mode pairs are declared once in `app/src/lib/game/rulesets/capabilities.ts` and mirrored by seed `0007`; 501 and Score Training accept `ANALYTICS + VISUAL_BOARD` at session creation as well as in batch validation (D196/D197, 2026-08-08). Review fixes D149–D152: batch request schema mirrors the write path's column CHECKs, `state()`/`facts()` return derived copies, `completedAt` stamped at visit resolution, undo depth documented (2026-07-26) |
| Database spec | `06-Database-Specification.md` v2.2.0 — split into `06-Spec/` chapters (2026-07-11) |
| Database handbook | `00`–`11` complete |
| API docs | v1 frozen; contracts `00`–`04`; error boundary (D131) + `SESSION_ALREADY_ACTIVE` single-active guard (D132); `03`→1.7.0 type-vs-value barrel rule (D156, 2026-07-26); `00`→1.4.0, `02`→1.3.0, `03`→1.6.0, `04`→1.2.0 (2026-07-22); prior: `01` frozen at 1.0.0, `02`→1.2.0, `03`→1.5.0 (2026-07-16/17); hardening `00`→1.3.0, `04`→1.1.0 (2026-07-13); auth proxy `00`→1.5.0, `02`→1.4.0 (D172, 2026-07-29); player settings `00`→1.6.0, `04`→1.3.0 (D195, 2026-08-08) |
| Application code | Auth middleware with route-class 401/403 handling + API error boundary (D131); frozen envelope/error helpers; player provisioning (D76); `POST /api/sessions` server-guards single-active (D132); logout flow (`signOut`, `LogoutButton`) complete; Score Training first-deploy write/read subset live (S1); same-origin Neon Auth proxy (`/api/auth/*`) fixes iOS standalone-PWA login (D172, 2026-07-29); `GET`/`PATCH /api/players/me/settings` with the Alpine settings store and profile `AppModeForm`, `createSession` rejecting an undeclared mode pair, and the games page filtered by app mode with banner + empty state (D195/D196, 2026-08-08) |
| Frontend docs | `03-Alpine-Patterns.md` →0.2.3 — toggle in UI registration list + anti-pattern for OOP instances on Alpine data (D187, 2026-08-07); prior `07-Style-Guide.md` →0.2.2 — Tailwind v4 utility syntax section (suffix `!important`, arbitrary negatives) before Anti-patterns (D175, 2026-07-31); `10`→0.1.6 — same rule condensed into §12 Styling + checklist (2026-07-31); prior 0.2.1 — top safe-area inset noted alongside `h-dvh` (D174, 2026-07-29); prior 0.2.0 — sky/glass/`surface`/`foreground` visual contract; legacy `bg-bg`/`text-fg`/old surface-badge-nav API retired (2026-07-22); Handbook `02`→0.2.1, `03`→0.2.1, `04`→0.1.1, `10`→0.1.3, overview `00`→0.3.4 — shared `session-recovery.ts` decision table (D118) + Score Training hard-gate completion / play-page results modal (D119, supersedes D112 for this flow) (2026-07-17); prior: prerender-default, Alpine factory, client auth gate (D98), auto-cleanup recovery, completed-batch outbox + `_v` store guard, `.astro` authoring conventions; prerendered protected shells decided public-by-design, JWT-gated API is the real boundary (D97, 2026-07-15); tests live under `app/tests/` (never colocated), `.astro` variant logic stays inline in frontmatter (D101, 2026-07-15); type/interface barrel-raising universal, no `.ts` outside `lib/`/`pages/api/`, centralized error mapping, self-learning gate (D103–D107, 2026-07-16); original `07-Style-Guide.md` 0.1.0 (D108, 2026-07-16) |
| Knowledge graph | graphify AST-only `graphify-out/graph.json` committed; freshness is CI-owned via `.github/workflows/graph.yml` (D185, 2026-08-03); canonical refresh via `scripts/refresh-graph.sh` (`graphify update .`), optional locally; CLI + hooks documented in root/app `CLAUDE.md` (2026-07-15) |
| Drizzle schema (`app/src/db/schema.ts`) | **Known deviation, awaiting owner ratification (2026-08-08):** `app/src/db/CLAUDE.md` says the file is generated by `drizzle-kit introspect` and must never be hand-edited. The `vPlayerSettings` entry was hand-written because introspect needs a live database and there is none in this container. It was verified against migration `0021` column-for-column and follows the file's existing view conventions, so the content is believed right and the violation is procedural. It must be diffed against a real introspect run before merge — if it disagrees, the next real run silently rewrites it and the mismatch becomes a runtime error rather than a type error (the same situation `locationX`/`locationY` hit in plan 1, D192). `0019`/`0020` were likewise never introspected |
| DB connection contract | `DATABASE_URL` = pooled (tooling), `DATABASE_URL_UNPOOLED` = direct (Worker runtime); `DATABASE_URL_POOLED` retired — user-verified against real `neonctl link` output (D95, 2026-07-15) |

---

# Maintenance Protocol

This map is kept correct by the mandatory Context Maintenance rules in the root `CLAUDE.md`: every new, moved, renamed, or deleted doc must be registered here in the same change; `scripts/check-context-map.sh` must pass; and the context-integrity guards `scripts/check-doc-links.sh` (canonical doc links + path-like refs) and `scripts/check-context-budget.sh` (per-file / per-pack `~tokens` drift) must pass before any task is claimed done. (2026-07-23)
