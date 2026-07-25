# Game Engine PR Review — Findings & Hardening Design (2026-07-25)

Status: review record. Scope: PRs #41 (Bob's 27), #42 (Singles Training), #43 (Doubles Training), #48 (501) — engine-only designs, stacked `main ← #41 ← #42 ← #43 ← #48`.

Reviewed against: `01-Principles.md`, `04-Architecture-patterns.md`, `05-Database/06-Spec/04-Runtime-Layer.md`, `05-Database/10-Database-Agent-Guide.md`, `07-Frontend/04-Modules-And-OOP.md`, `DECISIONS.md` (D01, D03, D07, D11, D13–D16, D40, D67, D84, D88, D90, D96, D111, D112, D122), `database/seeds/0001`–`0002`, `docs/game-rules/rulesets/*`.

## 0. Verification performed

- `cd app && npm test` on `origin/claude/501-engine-spec` → **305 passed (42 files)**. The PRs' green claims hold.
- Two behavioural probes written and run against the tip branch (then deleted) — results cited inline as **[probe]**.

Everything below is a design-level finding. No test in the four PRs is wrong; the tests assert the implemented behaviour faithfully.

---

## 1. Critical — architecture conformance

### C1. No engine consumes a configuration snapshot

All four engines hardcode their rules as module constants; constructors take at most a bare number (`startingScore`, `startingPoints`) and no engine can name its ruleset version.

This bypasses the configuration chain that the whole domain model is built on — D13/D14, Pattern 4 (Template → Snapshot Lifecycle), Pattern 5 (Configuration Snapshot): `configuration_templates → exercise_configurations → session`, "the structure of the JSONB is defined per game type by the ruleset version".

Concretely, the already-seeded 501 presets are unexecutable by `FiveOhOneEngine`:

| Seeded preset key | Value | Engine support |
| ----------------- | ----- | -------------- |
| `starting_score` | 501 | constructor param (not read from config) |
| `legs_to_win` | 1 / **3** | **none** — engine has no leg concept |
| `check_in` | `STRAIGHT_IN` | hardcoded (implicit) |
| `check_out` | `DOUBLE_OUT` | hardcoded |
| `max_darts_per_turn` | 3 | **not read** — engine is visit-total only |

`ScoreTrainingEngine` already does this correctly (`ScoreTrainingEngineOptions { durationType, durationValue, maxDartsPerTurn }` fed from the session config). The four new engines are a regression from the established precedent, not an extension of it.

**Extension cost:** every future rule option (double-in, master-out, 301/701, hard/challenge mode, high→low order) becomes engine surgery instead of a config value — the exact outcome Pattern 15 ("a new game should not require redesigning existing games") exists to prevent.

### C2. Two engines discard the facts and keep only the derivation

| Engine | Fact log | What survives a visit |
| ------ | -------- | --------------------- |
| Bob's 27 | **none** | `score: number` (+ current visit's 3 booleans) |
| Singles Training | **none** | `totalPoints: number` |
| Doubles Training | `VisitOutcome[]` | target, hit, which dart hit |
| 501 | `FiveOhOneVisitOutcome[]` | attempted, bust, remaining, checkout |

Bob's 27 and Singles Training invert the project's first principle — root `CLAUDE.md`: *"Store what happened. Derive what it means."* — D01, Pattern 9 (Derived Analytics), Database Agent Guide §1 ("Store facts. Derive statistics in views only. Never persist averages, percentages, or other derivable values").

The running score and the training-point total are **pure derivations** of the per-dart facts. Those facts are computed, applied to an accumulator, and thrown away. Consequences: no `turns`/`darts` rows can ever be produced, no per-target accuracy, no replay, no undo-safe reconstruction. The PR checklists tick "Statistics remain derived" — the opposite is true: the statistic is what's kept and the fact is what's dropped.

Four engines currently ship three different fact models (none / `VisitOutcome` / `FiveOhOneVisitOutcome`). That is the shape a fifth engine will copy.

---

## 2. Important — architecture conformance

### I1. No engine mints `clientKey` / `sequence` / `completedAt`

`07-Frontend/04-Modules-And-OOP.md` is canonical and explicit:

> **Engine vs Payload Modules** — `*.engine.module.ts` owns "In-session turn flow, scoring UX, **`clientKey` assignment**"
> **Key Ownership** — `clientKey` (per turn/dart) → owner: **Engine / payload assembly** → "Minted at fact creation"

`ScoreTrainingEngine.recordVisit()` complies (`crypto.randomUUID()`, `sequence`, `completedAt`). None of the four new engines do. Per the authority order, docs win: this is a conformance defect, not a preference.

Downstream effect: each play page will have to keep a *second* fact log in its store to carry the batch-payload fields, alongside the engine's own — two records of the same event that can diverge (`04-Architecture-patterns.md` anti-pattern: Business Logic Duplication).

### I2. No rehydrate path — resume is impossible

D67/D88/D90 make local-first recovery mandatory: in-progress state lives in `$persist`ed stores and the engine must be rebuildable on reload. D112 added `startingSequence` to `ScoreTrainingEngine` for exactly this, and D122 requires a "resume-safe engine rebuild when the instance has no local visits".

All four new engines can only be constructed empty. Their `history` (undo stack) is a private array of state snapshots — not serializable, not reconstructable from persisted facts. A refresh mid-game either loses the game or leaves store and engine desynchronised. For Bob's 27 and Singles Training it is *unfixable without a schema change to the engine*, because (C2) the facts needed to replay into the current state were never kept.

### I3. No shared engine contract

| | Bob's 27 | Singles | Doubles | 501 | Score Training |
| - | - | - | - | - | - |
| record | `recordDart(hit: boolean)` | `recordDart(ring: DartRing)` | `recordDart(hit: boolean)` | `recordVisit(score, checkout?)` | `recordVisit(score)` |
| undo | `undoLastDart()` | `undoLastDart()` | `undoLastDart()` | `undoLastVisit()` | `undoLastVisit()` |
| done | `isGameOver()` + `result()` | `isComplete()` | `isComplete()` | `isComplete()` | `isComplete(turns, timerExpired)` |
| score | `currentScore()` | `currentPoints()` | — | `currentScore()` | `currentTotal()` / `currentAverage()` |
| facts | — | — | `visitHistory()` | `visitHistory()` | — |

Five engines, five APIs. Every shared consumer — play page, game store, payload builder, undo button, `GameLayout` leave/abandon flow (D121), finish-confirm modal (D122), hard-gate completion (D119) — must special-case each game. The DB satisfies Pattern 15; the client does not.

### I4. No `ruleset_versions` binding; seeds and engines disagree

- `services/rulesets/registry.ts` contains **only** `SCORE_TRAINING_V1`. `POST /api/sessions` rejects any `rulesetVersionKey` without a registered validator (`session.service.ts:249`) — so none of the four games can start a session.
- `game_types` seeds: `501`, `TUOD`, `SINGLES_TRAINING`, `SCORE_TRAINING`. **`BOBS27` and `DOUBLES_TRAINING` do not exist** in any seed.
- `SINGLES_V1`'s seeded presets declare `order_mode: HIGH_TO_LOW | RANDOM` and `difficulty: NORMAL | HARD` — a game the V1 engine cannot play (flagged by PR #42, still unresolved).
- `501_V1` is seeded with a `legs_to_win: 3` preset; the shipped engine is single-leg. **PR #48's spec §6 claims the 501 seed data "is already consistent with this V1 scope, unlike the Singles Training seed/doc mismatch" — it is not.** Same class of mismatch, one PR later.
- D03 makes rulesets immutable ("games extensible, rulesets immutable"). Growing `FiveOhOneEngine` into multi-leg/per-dart while it stays bound to `501_V1` would rewrite what an already-seeded ruleset version means. The version pin must be decided now, not at the persistence step.

### I5. Persistence semantics unresolved — and partly unrepresentable

- **Bob's 27 full-miss penalty is a negative turn total.** `darts.score` is CHECK ≥ 0 (migration `0006`), and `04-Runtime-Layer.md` documents `turns.total_score` as a controlled denormalisation of the sum of dart scores. A −1 turn total is storable (INTEGER, no CHECK) but violates the documented invariant. Needs an explicit modelling decision.
- **Singles Training points are not board scores.** 1/2/3 stored in `turns.total_score`/`darts.score` would silently corrupt any cross-game aggregation. They are also fully derivable from `hit_target_number` + `hit_zone_id` — so under Pattern 9 they must *not* be stored at all; the ring facts must be.
- Bull mapping (`SINGLE`/`DOUBLE` on a bull target → `OUTER_BULL`/`INNER_BULL`, target number 25) is correctly flagged in the specs but lives only in `docs/superpowers/`, which the Context Map marks **historical — never read by default**.

### I6. Bob's 27 leaks a resolved visit's darts into the next visit

`bobs27.engine.module.ts:31` clears `dartsThisVisit` lazily on the *next* dart instead of at visit resolution. After a resolved visit the state advertises the new target and the **old** visit's darts simultaneously.

**[probe]** three darts at D1 (hit, miss, miss) → `currentTarget() === {kind:"DOUBLE",number:2}` while `state.dartsThisVisit === [true,false,false]`.

This contradicts the PR's own approved spec (§3 step 5: "Reset `dartsThisVisit = []`") and both sibling engines (which reset to `0`). Any UI binding "darts thrown this visit" renders the previous visit. Not covered by a test — `bobs27.engine.module.test.ts:206` asserts the leaked value as correct.

### I7. 501 accepts impossible and negative visit scores

`applyVisit` performs no domain validation of `scoreAttempted`.

**[probe]** `recordVisit(-100)` on a fresh engine → remaining score **rises to 601**. `recordVisit(200)` → accepted as a legal reduction to 301 (max possible visit is 180).

PR #48 declines this deliberately, citing recreational input trust and the `ScoreTrainingEngine` precedent. That reasoning conflicts with a canonical rule — Database Agent Guide §8 / D15: *"Max darts per turn, **score caps**, bust rules — enforced by the application from the ruleset version."* The engine is the named owner of score caps; declining them leaves no owner at all. A mistyped `1800` silently corrupts the fact log with an unachievable `scoreAttempted`.

### I8. 501's checkout validation is not the double-out rule

Win requires `checkout.dartsOnDouble >= 1`. The rule (ruleset `501.md`, "Double out") is that **the dart that reaches exactly 0** must be a double. A visit that puts one dart in a double and then finishes on a single validates as a win.

`dartsOnDouble` is defined in the spec as "aimed at/**landed on** a double" — two different facts under one name. `dartsUsed` is captured, never read by any rule, and never coherence-checked against `dartsOnDouble` (declined in review). The correct shape is a boolean finishing-dart fact plus, separately, doubles-attempted as analytics.

---

## 3. Minor

- **M1 — `targetForIndex` triplicated.** `bobs27`/`singles`/`doubles` each implement the D1→D20→bull progression; the Bob's 27 and Doubles copies are identical modulo the type name. All four PRs tick "Introduces no duplicated business logic".
- **M2 — flat `modules/game/types.ts`.** Five games' types in one 86-line file, three modules exporting a symbol named `applyDart`, and `VisitOutcome` (Doubles-specific) squatting the generic name beside `FiveOhOneVisitOutcome`. No barrel can raise these without collisions.
- **M3 — engines return live internal state.** `recordDart`/`recordVisit` return `this.state` and `visitHistory()` returns the live array, guarded only by a JSDoc warning. Assigning that into an Alpine store wraps engine-owned state in a reactive proxy — D120 documents how costly Alpine aliasing surprises are here.
- **M4 — undo contracts diverge.** Unbounded per-dart undo (three engines) vs per-visit (501) vs D122's committed one-turn-back undo for Score Training. No documented rule for how far undo may reach.
- **M5 — resolved rules recorded nowhere canonical.** Bob's 27 bull = inner 50 only / outer = miss, multi-hit face-value math, Singles bull = outer 1 / inner 2, Doubles bull identity: all resolved in specs, none written back to `docs/game-rules/rulesets/*.md`, whose "Open questions" sections still list them as open. The resolutions exist only in `docs/superpowers/` (historical, never read by default).
- **M6 — 501 spec §3.4 vs code.** The spec says a bust records the `checkout` when one was passed; the code records it only when `wouldRemain === 0`. The code's behaviour is the better one — the spec is wrong.

---

## 4. Process

- **P1 — four-deep stack, zero merges.** `main` is at `c5fade4`; all four branches sit ahead of it. Root `CLAUDE.md` and D96: task branches land on `main` via PR at completion, "long-lived divergence from `main` is a defect". Any change to #41 forces three rebases. PR #48 flags this itself.
- **P2 — a pattern adopted four times with no decision entry.** The pure-reducer + class-wrapper shape is new (Score Training has no reducer) and is now the de-facto standard for every engine. `04-Architecture-patterns.md` "Pattern Adoption Process" step 5 requires a `DECISIONS.md` entry on adoption; all four PRs tick "no new decision".
- **P3 — knowledge graph stale on all four branches** (graphify CLI absent; escape hatch correctly disclosed). One refresh needed before merge.
- **P4 — the same defect class recurred three times.** Push-before-apply corrupting undo history was found post-hoc in #41 and #42, then carried forward as prose in #43/#48's PR bodies. Nothing mechanical stops engine #5 from reintroducing it.

---

## 5. Scalability & extension verdict

| Goal | Verdict |
| ---- | ------- |
| New game without redesigning existing games (Pattern 15) | **At risk on the client.** DB side holds; every engine adds a bespoke API, a bespoke state shape, and a bespoke fact model that consumers must special-case. |
| New rule option without engine surgery (D13/D14, Pattern 4/5) | **Not met.** Rules are constants; no engine reads a config snapshot. |
| Years of progression analytics (D01, Pattern 9) | **Not met for 2 of 4.** Bob's 27 and Singles Training keep derivations and discard facts. |
| Replayability / immutability (Pattern 3, D11) | **Deferred but blocked.** Nothing violates immutability yet — but two engines cannot produce the rows a replay reads. |
| Local-first resume (D67, D88, D112) | **Not met.** No engine can be rehydrated. |
| Ruleset immutability (D03) | **At risk.** Engines are unbound to ruleset versions while seeded versions describe wider games. |

The four PRs are internally excellent — well-tested, spec-faithful, consistent in style. The problem is entirely at the seam between the engines and the platform they must plug into: **scope was drawn as "pure logic, no persistence, no config, no session" four times in a row, and every one of the deferred items is exactly the thing that determines whether the engine's chosen state shape is viable.** Deferring persistence is fine; choosing a state shape that cannot express it is not.

---

## 6. Score Training on `main` — same audit

Requested check: does the already-merged Score Training build carry the same defects? **Partly — and where it doesn't, it disproves two of the PRs' stated justifications.**

### What Score Training gets right (and the four PRs dropped)

| Criterion | Score Training on `main` |
| --------- | ------------------------ |
| Config-driven construction (C1) | ✅ `new ScoreTrainingEngine({durationType, durationValue, maxDartsPerTurn})` fed from `$store.game.configSnapshot`, which is copied from the selected preset (`score-training-setup.data.ts:126-139`) |
| `clientKey`/`sequence`/`completedAt` minted in engine (I1) | ✅ `score-training.engine.module.ts:12-19` |
| Rehydrate on resume (I2) | ✅ `startingSequence: this.$store.game.turns.length` (D112), plus engine rebuild on undo-after-resume (`score-training-play.data.ts:208-218`) |
| Ruleset validator registered (I4) | ✅ `SCORE_TRAINING_V1` in the registry, capture/input-mode matrix enforced |
| Score cap owned by the ruleset (I7) | ✅ **enforced twice** — client `0..180` guard (`score-training-play.data.ts:153`) and server `validateBatch` `0..180` (`score-training.validator.ts:49`) |

**This invalidates PR #48's rationale for declining 501 score validation.** The PR cites "the `ScoreTrainingEngine` precedent and the spec's explicit recreational-input-trust stance". The actual precedent is the opposite: Score Training enforces the cap on both sides of the wire. Finding I7 stands, reinforced.

It also means the four PRs are a **regression from a merged, working implementation**, not a first attempt at an unsolved problem — the solutions to C1, I1 and I2 already exist in the repo and were not carried forward.

### Defects Score Training does share or introduce

- **ST1 (Critical, scalability) — the shared store is Score-Training-shaped.** `stores/types.ts` defines `GameConfigSnapshot = {durationType, durationValue, maxDartsPerTurn}` — one game's config schema, under a game-agnostic name, inside the single shared `game.store.ts` used by every game. `RecordedTurn = {clientKey, sequence, totalScore, completedAt}` is visit-total-only with no dart facts. **The four new engines have nowhere to put their data**: Singles/Doubles per-dart facts, 501 legs and checkouts, and Bob's 27 hit/miss patterns are all unrepresentable in the store that persists in-progress play (D67/D86/`$persist`). This is the concrete blocker behind C2 and I2.
- **ST2 (Important) — duplicate fact log.** `ScoreTrainingEngine.visits[]` and `game.store.turns[]` hold the same facts. The store is the real owner (it is what `$persist`s and what `buildEventsBatch` reads); the engine's copy is a shadow that goes empty on resume, which is why undo needs the rebuild branch at `score-training-play.data.ts:208-218`, and why the engine's own `currentTotal()`/`currentAverage()` are dead code — the play page recomputes with a local `computeStats()`. Anti-pattern: Business Logic Duplication.
- **ST3 (Important) — config vocabulary translated by hand in two directions.** `setup.data.ts:126-139` maps `snake_case` preset keys → camelCase snapshot; `play.data.ts:317-321` maps back for Play Again. No shared codec, no shared schema with the server-side `ScoreTrainingConfig` Zod schema in `services/rulesets/score-training/types.ts` (browser code cannot import `services/`). Every new game triples this.
- **ST4 (Important) — Play Again changes config provenance.** First play sends `config: {source: "template", templateRef}` (D13/D71 preset lineage); Play Again sends `{source: "inline", config: {...}}` reconstructed from the local snapshot. Two sessions of the same game get differently-sourced configuration snapshots.
- **ST5 (Minor, real bug) — stuck `loading` flag.** `score-training-play.data.ts:149-150` sets `this.loading = true` and then returns from the guard on the next line without resetting it. Whenever `submitVisit` is called with no engine (missing config snapshot) or while the finish-confirm modal is open, the submit control stays disabled until reload.
- **ST6 (Minor) — payload module hardcodes the stage.** `buildEventsBatch` emits a single `EXERCISE_BLOCK` stage with `clientKey: "stage-1"`, `sequence: 1`. Correct for Score Training; 501 needs real `LEG` stages, so stage assembly must move into the contract rather than be copied per game.
- **ST7 (Minor) — `isComplete(turnsSoFar, timerExpired)` takes external state**, unlike the four new engines which own their completion state. The contract has to reconcile the two philosophies.

**Verdict:** Score Training is the better model on every axis the four PRs regressed on, and the weaker model on fact ownership (ST2) and store genericity (ST1). The hardening target is therefore not "make the four engines look like Score Training" — it is one contract that keeps Score Training's config/keys/rehydrate discipline and fixes its duplicate-fact-log and single-game store.
