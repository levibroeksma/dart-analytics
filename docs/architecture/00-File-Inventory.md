<!--
status: canonical
scope: canonical file inventory — what each document answers
read-when: a context pack demonstrably lacks the answer
updated: 2026-09-01
-->

> Escalation target for `00-Context-Map.md`. Packs come first; open this
> only when the pack lacks the answer. History lives in
> `00-Context-Map-History.md`.

---

# File Inventory

Status: **canonical** = current truth · **historical** = preserved record, never read by default · **generated** = tool output, do not hand-edit.

## Foundation (`docs/architecture/`)

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `README.md` | Documentation philosophy and hierarchy | canonical | ~1.5k |
| `00-Context-Map.md` | The router — context packs, authority order, maintenance protocol (2026-08-19) | canonical | ~1.7k |
| `00-File-Inventory.md` | This file — what each canonical document answers; escalation target when a pack falls short (2026-08-20) | canonical | ~10.4k |
| `00-Context-Map-History.md` | Context-map version history and point-in-time task records; provenance only, never loaded by a task (2026-08-19) | historical | ~45.1k |
| `01-Principles.md` | What we believe (core values + decision priorities) | canonical | ~2.1k |
| `02-System-Architecture.md` | System layers, data flows, ownership | canonical | ~1.9k |
| `03-Engineering-Workflow.md` | 10-phase change lifecycle | canonical | ~2.2k |
| `04-Architecture-patterns.md` | Recurring design patterns + anti-patterns; Pattern 18 game engine contract, incl. undo depth, derived-value returns, `completedAt` timing, and the win-condition categories/`match-outcome.module.ts`/`activeSeat()` completion predicate (2026-07-26; win-condition subsection added 2026-08-22); Pattern 20 shared accuracy/hit-rate formatting via `accuracyDisplay()` (2026-08-27); Pattern 21 exclusive score-band tallying via `visitScoreBandCounts()` (2026-08-27); Pattern 18 gains `checkout-bust.module.ts` and `otherSeatsComplete`'s completion-predicate parameter (2026-08-27, D240); Pattern 21 gains a fifth band, Pattern 18's `checkout-bust.module.ts` gains `checkoutAttemptCount` (2026-08-28, D242) | canonical | ~6.8k |
| `08-DartBot.md` | Simulated opponent architecture: seat layer plug-in, the play loop, delivery phases, board-geometry/engine-contract boundaries; phases 1–7 (throw engine, calibration, dictated strategy, seat admission, participant write path, play loop, `X01Strategy` + 501 opponent mode) are built — see `app/src/modules/dartbot/`, `app/src/lib/game/guest-list.ts`/`session-mode-resolution.ts`/`play-lifecycle.ts`/`bobs27-play.data.ts`/`five-oh-one-play.data.ts`, `app/src/services/session.service.ts`; phase 8+ (ghost mode) remains design-only (2026-09-02) | canonical | ~23.9k |
| `09-training-routines.md` | Proposed architecture for training routines, exercises, exercise engines; configurable/adaptive training, extends `GameEngine`/ruleset/configuration-snapshot architecture (2026-09-01) | canonical | ~6.3k |
| `10-trivia.md` | Checkout trivia architecture: standalone untimed flashcard quiz drilling checkout routes; reuses `checkout-path.module.ts`, explicitly not integrated with `09-training-routines.md` (2026-09-01) | canonical | ~3.4k |
## Database handbook (`05-Database/`)

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `00-OVERVIEW.md` | Database philosophy and operating model | canonical | ~2.5k |
| `01-Naming-Conventions.md` | Table/index/constraint/view naming | canonical | ~2.3k |
| `02-Design-Rules.md` | Schema design rules, controlled denormalisation | canonical | ~2.4k |
| `03-Migrations.md` | Migration process + chain `0001`–`0023`; `0019`/`0020` capability table + composite FK and their migrate→seed→migrate apply order, `0021` `v_player_settings` (2026-08-08), `0022` `v_player_profile` (2026-08-15), `0023` owner-scoped dart views (2026-08-21) | canonical | ~4.3k |
| `04-Indexes.md` | Index strategy (query-path driven) | canonical | ~2.6k |
| `05-Views.md` | View categories and replay rules; nine implemented views through `0023` (2026-08-21) | canonical | ~2.2k |
| `06-Database-Specification.md` | Cross-layer invariants + index into `06-Spec/` chapters | canonical | ~2.2k |
| `06-Spec/01-Reference-Layer.md` | Lookup tables (game_types … duration_types); `ruleset_version_capabilities` and why capability is keyed on ruleset version (2026-08-08) | canonical | ~2.1k |
| `06-Spec/02-Template-Layer.md` | Templates, routines, configuration presets | canonical | ~1.6k |
| `06-Spec/03-Player-Layer.md` | players, player_settings — settings shipped, read through `v_player_settings`, capture/input mode FKs added by `0017`; profile (darts equipment) shipped, read through `v_player_profile` (2026-08-15) | canonical | ~1.1k |
| `06-Spec/04-Runtime-Layer.md` | Activities, sessions, stages, turns, darts, idempotency; turn/dart score semantics, `location_x`/`location_y` shipped, VISUAL_BOARD capture depth, QUICK_SCORE-scoped 501 bust limitation + `total_score` bust carve-out (2026-08-05) | canonical | ~3.9k |
| `06-Spec/05-Read-Model-Layer.md` | View contracts (`v_*`), incl. `v_dart_locations` (2026-08-05), `v_player_settings` (2026-08-08) and the owner-scoping both dart views gained in `0023` (2026-08-21) | canonical | ~2.9k |
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
| `06-API/04-Endpoint-Contracts.md` | Per-domain endpoint contracts (2026-07-22); Player Settings `GET`/`PATCH /api/players/me/settings` incl. the uncapable-pair `VALIDATION_FAILED` case (D195, 2026-08-08); `POST /sessions`' `SEAT_CAPS` table (2026-08-22) | canonical | ~5.7k |
| `07-Frontend/00-Overview.md` | Client integration, state ownership, handbook index (2026-07-17) | canonical | ~3.4k |
| `07-Frontend/01-Rendering-Strategy.md` | Prerender-default, middleware, client auth gate (D98), route classes; same-origin auth client (D172, 2026-07-29) | canonical | ~2.2k |
| `07-Frontend/02-Folder-Structure.md` | `app/src/` tree, aliases, suffixes; cross-runtime `lib/game/rulesets/` (2026-07-26); `modules/dartbot/` + `.strategy.module.ts` registered (2026-09-01) | canonical | ~2.0k |
| `07-Frontend/03-Alpine-Patterns.md` | Alpine factory, stores, forms, `$persist` (D120 per-field factory), recovery/hard-gate; UI module instances held off the reactive object (D187, 2026-08-07) | canonical | ~3.2k |
| `07-Frontend/04-Modules-And-OOP.md` | OOP boundary, portable UI kit, `GameEngine` contract members (derived-value returns, undo depth) + engine anti-patterns (2026-07-26) | canonical | ~1.9k |
| `07-Frontend/05-Astro-Components.md` | `.astro` authoring: frontmatter order, props, class composition, slots; template `{/* */}` comments; Prettier `singleAttributePerLine` (2026-07-21) | canonical | ~2.1k |
| `07-Frontend/06-Test-Strategy.md` | Shared-mock promotion rule, full-suite-always-runs policy (2026-07-16) | canonical | ~0.7k |
| `07-Frontend/07-Style-Guide.md` | Sky/glass/surface visual contract: tokens, primitives, typography, motion, a11y; Tailwind v4 utility syntax section — no important modifier, either form, arbitrary negatives (D226 supersedes D175, 2026-08-21); top safe-area inset noted alongside `h-dvh` (D174, 2026-07-29) | canonical | ~3.7k |
| `07-Frontend/08-Component-Inventory.md` | Every shared `.astro` component, its purpose and key props; check before hand-rolling markup; `IconBtn.astro` added (2026-08-21) | canonical | ~1.7k |
| `07-Frontend/09-Adding-A-Game.md` | The 26-file fan-out a new game requires, the six shared registries that fail silently, `bobs27` as the reference exemplar, the route-slug/code-slug rule, and the three setup-controller opt-outs (2026-08-20) | canonical | ~2.1k |
| `07-Frontend/10-Frontend-Agent-Guide.md` | Condensed frontend agent rules; comment/format checklist; TS JSDoc-above convention (2026-07-21) | canonical | ~2.1k |

## SQL (`database/`)

| File | Answers | Status |
| ---- | ------- | ------ |
| `README.md` | Directory layout, apply order | canonical |
| `migrations/0001`–`0023` | Applied schema chain — never modify; `0023` scopes the two dart analytics views to the owning participant (D222, 2026-08-21) | canonical (applied) |
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
| `database/verification/0022_player_profile_checks.sql` | `v_player_profile` column set, configured/unconfigured player resolution, `chk_players_darts_description_not_empty`/`chk_players_darts_weight_grams_range` fire correctly (11 checks) (2026-08-15) | canonical |
| `database/verification/0023_owner_scoped_dart_view_checks.sql` | `v_dart_analytics`/`v_dart_locations` return only the session owner's own dart, excluding both a GUEST and a DARTBOT participant's; `v_game_replay` deliberately returns all three (D222, D193; DARTBOT fixture added phase 5, 2026-09-01) | canonical |

## Game engine code + mechanical guards

Registered for discoverability, not as reading material — the rules live in `04-Architecture-patterns.md` Pattern 18 and `07-Frontend/04-Modules-And-OOP.md`. (2026-07-26)

| File | Answers | Status |
| ---- | ------- | ------ |
| `app/src/lib/game/rulesets/types.ts` | One `.strict()` Zod config schema per ruleset version (cross-runtime) | canonical |
| `app/src/lib/game/rulesets/config-codec.ts` | snake_case wire config ↔ camelCase client snapshot | canonical |
| `app/src/lib/game/rulesets/refinement-contract.ts` | Declared accept/reject boundaries every schema refinement must hold | canonical |
| `app/src/lib/game/rulesets/capabilities.ts` | `RULESET_CAPABILITIES` + `supportsMode` / `capableRulesets` (exact pair, gates session creation) and `supportsCaptureMode` (capture mode alone, gates games-page card visibility only — 2026-08-12) — the cross-runtime code-side declaration of which capture/input mode pairs each ruleset version implements; mirrored by seed `0007` (D196, 2026-08-08); `RULESET_DARTBOT` + `supportsDartbot` + `DEFAULT_BOT_LEVEL` — which four ruleset versions currently admit a DartBot opponent seat, read by both the setup screens (chooser gate) and `session-seats.service.ts` (server-side gate) (2026-09-02) | canonical |
| `app/src/lib/game/rulesets/games-visibility.ts` | Filters `GameCardDescriptor`s by the player's app mode via `supportsCaptureMode` (capture mode alone, not the exact pair — a ruleset like `BOBS27_V1` that pairs `RECREATIONAL` with `DETAILED_DARTS` instead of the app's actual `QUICK_SCORE` setting must still show a card); drives the games page's cards, banner and empty state (2026-08-08; capture-mode-only filter 2026-08-12) | canonical |
| `app/src/lib/game/games-index.data.ts` | `GAME_CARDS` — the games-page card list the visibility filter is applied to (2026-08-08) | canonical |
| `app/src/lib/game/bobs27-play.data.ts` | `bobs27Play()` — Bob's 27's play-page game loop (record → mirror → complete, both recreational tap and board dart paths funnel through one `commitDart`), the board's 1.5s reveal-then-clear (`visitMarkers()` override), `currentTargetLabel()`/`currentScore()`/`previewSegments()` display reads; no checkout/bust confirm dialogs (2026-08-12; target-label/preview/observation logic moved to `doubles-path-play.ts` 2026-08-13; a seated `DARTBOT` opponent now throws automatically via `maybeRunBotVisit()`/`throwBotDart()`, wired into `init`/`commitDart`/`undoVisit` — DartBot phase 6, 2026-09-01) | canonical |
| `app/src/lib/game/doubles-path-play.ts` | `doublesPathTargetLabel`/`doublesPathPreviewSegments`/`doublesPathObservation` — the target-label, visit-preview and hit/miss `DartObservation` builder for the shared BULL-terminated numeric doubles path (`doublesPath()`), deduped out of `bobs27-play.data.ts` and `doubles-training-play.data.ts` after the byte-identical duplication was flagged in review (2026-08-13) | canonical |
| `app/src/lib/game/doubles-training-setup.data.ts` | `doublesTrainingSetup()` — mirrors `singles-training-setup.data.ts`: zero editable settings, reconciles against the one seeded preset (`database/seeds/0003_game_engine_reference.sql`, id `...000010`, `{mode: EASY, order_mode: LOW_TO_HIGH}`) (2026-08-13) | canonical |
| `app/src/lib/game/doubles-training-play.data.ts` | `doublesTrainingPlay()` — Doubles Training's play-page game loop; `currentTargetLabel()`/`previewSegments()`/the tap `recordTap`'s BULL/DOUBLE mapping delegate to `doubles-path-play.ts`, and `init`/`retryReconciliation`/`commitDart`/`undoVisit`/`uploadAndCompleteSession`/`back`/`abandonAndExit`/`playAgain` delegate to `play-lifecycle.ts` (own only its `resumeEngine`, `resultsSnapshot`-builder, and `instanceof`-narrowing callbacks); `hitCount()`/`missCount()` read `engine.state().outcomes` directly (visit-level, not dart-scanned — a full-miss visit is exactly one miss, never three); synchronous `hiddenTurnKey`, no reveal-then-clear timer (`DOUBLES_TRAINING_V1` never enters `VISUAL_BOARD`) (2026-08-13; lifecycle delegated to `play-lifecycle.ts` 2026-08-13) | canonical |
| `app/src/lib/game/play-lifecycle.ts` | `playInit`/`playRetryReconciliation`/`playCommitDart`/`playUndoVisit`/`playUploadAndCompleteSession`/`playBack`/`playAbandonAndExit`/`runPlayAgain` — the record → mirror → complete lifecycle shared by every ruleset with no board input and no reveal-then-clear timer (Doubles Training and Singles Training; Bob's 27's `VISUAL_BOARD`/`hiddenTimer` branch and 501/Score Training's `ScoreInputBuffer` shape stay out), generic over `<TConfig, TEngine extends GameEngine<DartObservation, unknown>, TResults>` via `PlayLifecycleContext` in `lib/game/types.ts`; deduped out of `doubles-training-play.data.ts`/`singles-training-play.data.ts` after their overlap crossed `fallow`'s CI duplication threshold (D209, 2026-08-13); `undoToActiveSeat()`, `playRunBotVisualBoardVisit()` (the `botThrowing` + post-delay re-entrancy guards) and `playFoldBotQuickScoreVisit()` — the generic DartBot play-loop mechanism, wired onto Bob's 27 (D252, DartBot phase 6, 2026-09-01); `playFoldBotQuickScoreVisit()`'s `throwDart` widened to `(state: TState) => DartObservation` so a strategy can re-target between darts off the scratch engine's own live state, wired onto 501 (D253, DartBot phase 7, 2026-09-02) | canonical |
| `app/src/lib/game/singles-training-play.data.ts` | `singlesTrainingPlay()` — Singles Training's play-page game loop; target-aware `recordTap(ring)` (BULL visit maps SINGLE/DOUBLE → OUTER_BULL/INNER_BULL, TREBLE rejected) and a locally-duplicated `trainingPointsFor` (the engine doesn't export its own — documented seam) stay local, but `init`/`retryReconciliation`/`commitDart`/`undoVisit`/`uploadAndCompleteSession`/`back`/`abandonAndExit`/`playAgain` delegate to `play-lifecycle.ts` (own only its `resumeEngine` and `resultsSnapshot`-builder callbacks); session-total hit-count getters `missCount()`/`singleCount()`/`doubleCount()`/`trebleCount()` classifying `hitZoneKey` across all turns, exhaustive over `DartZoneKey`'s 8 members (bull `OUTER_BULL`/`INNER_BULL` fold into single/double, mirroring `trainingPointsFor`'s scoring equivalence) (2026-08-13; lifecycle delegated to `play-lifecycle.ts` 2026-08-13) | canonical |
| `app/src/modules/game/interfaces.ts` | `GameEngine` / `GameEngineFactory` — the contract itself | canonical |
| `app/src/modules/game/engine.registry.ts` | `rulesetVersionKey` → engine factory lookup | canonical |
| `app/src/modules/game/board-progression.module.ts` | Shared board paths and dartboard arithmetic | canonical |
| `app/src/modules/game/client-key.module.ts` | `newClientKey()` — transient batch correlation token, explicitly not an entity id (D190) (2026-08-05) | canonical |
| `app/src/modules/game/checkout-path.module.ts` | Standard 2-170 double-out checkout chart; `null` for bogey numbers (2026-08-01) | canonical |
| `app/src/modules/game/checkout-darts.module.ts` | Which darts-to-finish / darts-at-a-double answers a checkout may claim, read off the chart, plus the rejection all three quick-score engines share (D217) (2026-08-20) | canonical |
| `app/src/modules/game/events.payload.module.ts` | The one `buildEventsBatch` for every game; reads each turn's own `participantRef` so refs vary within one batch (D220, 2026-08-21) | canonical |
| `app/src/modules/game/seat-rota.module.ts` | Pure seat derivation shared by every engine: `activeSeat` (from the fact log, never stored), `startingSeatFor`, `seatOf`; serves both `SHARED` and `PER_SEAT` stage shapes (D220, 2026-08-21) | canonical |
| `app/src/modules/game/turn-log.module.ts` | Pure turn-log mechanics every engine shares: `cloneTurns`, `sumDartScores`, `dartsThrownBy`, `openOrCreateTurn`/`appendCompletedTurn`, `openVisit`, `resolveObservation`/`appendResolvedDart`, `appendObservedDart`/`doubleTargetIntent`, and the three undo shapes (`undoLastDart`, `undoLastUnit`, `undoStagedTurn`) (2026-08-23) | canonical |
| `app/src/modules/game/seat-state.module.ts` | Pure per-seat derivation every 1v1 engine shares: `foldSeatStates` (replay the log once per seat), `activeSeatState`, `otherSeatsComplete`, `durationSeatComplete`, `completedByIndex` (2026-08-23) | canonical |
| `app/src/lib/game/guest-list.ts` | `addTypedGuest` — the add-a-guest modal rule every setup screen shares: at most one guest, trimmed non-blank name, modal closed on success; `addBotOpponent` — the DartBot branch of the same single opponent slot, mutually exclusive with a guest (2026-08-23; DartBot 2026-09-01) | canonical |
| `app/src/modules/game/tuod.engine.module.ts` | Ten Up One Down: the checkout ladder folded from attempt turns (2026-07-26) | canonical |
| `app/src/lib/game/board/board-geometry.module.ts` | Regulation board radii, clockwise sector order, `classify(x, y)` → `BoardHit` (target/zone/score), `zoneCentroid`; `trebleInner` corrected 97→99mm so the treble ring is 8mm wide like the double ring (2026-08-05; radius fix 2026-08-11) | canonical |
| `app/src/lib/game/board/miss-margin.module.ts` | Distance + bearing from a dart's landing point to its declared zone's centroid; deliberately outside SQL — see `v_dart_locations` (2026-08-05) | canonical |
| `app/src/modules/game/board-input.module.ts` | Visual board input, pure: `screenToBoard` (viewport px → board mm via the SVG's inverse screen CTM), `boardPxPerMm`, `resolveMagnifierSide`/`clampMagnifierPlacement` (handedness+edge-flip side resolved once per gesture on press, clamped per move so it never swaps sides mid-drag — #83, 2026-08-11), `magnifierPlacement` (single-call wrapper of both, D199, 2026-08-09), `boardInput` press-drag-release state machine | canonical |
| `app/src/lib/game/board-input.data.ts` | Alpine/DOM bridge for the board: pointer events → controller, a fresh controller per press so a resize or rotation between gestures is picked up; reads `$store.boardInput.handedness` into each fresh controller (D206, 2026-08-11) | canonical |
| `app/src/stores/board-input.store.ts` | `boardInput` Alpine store: one `$persist` `handedness` field, local-only rather than routed through `player_settings` (D206, 2026-08-11) | canonical |
| `app/src/lib/game/session-mode-resolution.ts` | `resolveSessionModePair` (player settings + ruleset capability → the pair a new session is created with), `participantsFromSeats`, `participantsFromGuests` (the setup screen's start-time twin of `participantsFromSeats`, now also seating a DartBot opponent), and `startSessionInput` (the store payload both setup pages send, seats composed into the snapshot via the private `toSeatFacts`, which admits `PLAYER`/`GUEST`/`DARTBOT` — `seatsFromParticipants` was deleted, its `PLAYER` fallback was the two-way-collapse anti-pattern DartBot admission had to remove), shared by both play pages (2026-08-10; seats 2026-08-21; `participantsFromGuests` 2026-08-23; DartBot 2026-09-01) | canonical |
| `app/src/lib/game/setup-controller.ts` | `createPresetSetupController` — the preset setup skeleton six games share; one seam (`configOverrides`) for the two training games' target order; 501 and Score Training deliberately opt out (2026-08-19) | canonical |
| `app/src/lib/game/five-oh-one-starting-score.ts` | `FIVE_OH_ONE_STARTING_SCORE_NOTICE` + `clampFiveOhOneStartingScore` — floors and clamps the custom 501 starting-score input to the inclusive 2–999 bound; a non-finite/blank input clamps to the custom field's stated default of 101, not the bare minimum of 2; mirrors `five-oh-one-legs.ts`'s clamp shape (2026-08-11) | canonical |
| `app/src/components/ui/DartBoard.astro` | Presentational dartboard SVG, millimetre `viewBox`, `role="img"` + `aria-label`; optional `boardRef` opts one instance into the controller's `x-ref` (2026-08-09) | canonical |
| `app/src/components/ui/BoardMagnifier.astro` | Zoomed inset following the fingertip: a second clipped `DartBoard`, crosshair, live resolved read with a `glass` background for legibility; `aria-hidden`, `fixed`, zoom scaled to the displayed board (D199, 2026-08-09; glass label 2026-08-11) | canonical |
| `app/src/components/ui/InfoSection.astro` | Collapsible info panel (heading + chevron-toggled description); `title` rendered verbatim, optional `id` for a caller's `aria-labelledby`; moved from `components/layout/games/setup/` so profile-page forms could reuse it outside the games domain (#84, 2026-08-11) — `HandednessForm.astro` reused it until the 2026-08-16 inline-edit redesign moved it under a plain-heading card; `AppModeForm.astro` still does | canonical |
| `app/src/components/layout/games/BoardInputPanel.astro` | The board block both play pages mount: mode gate, `touch-none` pointer surface, magnifier `x-if` guard, equal-size Undo (left) / `glass` Bounce out (right) actions built from `components/forms/Button.astro`; declares no `x-data` of its own (2026-08-09; button layout 2026-08-11; Button.astro reuse 2026-08-11) | canonical |
| `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro` | 501's setup form, rebuilt on Score Training's shared setup components (`SetupShell`, `UserSection`, `InfoSection`, `SettingSectionShell`, `Toggle`, `Input`): starting-score `Toggle` (301/501/701/Custom) + conditional custom-value `Input`, `legsToWin` `Input`, each with its own clamp-notice `<p role="status">`; moved from `components/layout/games/` (old flat file removed), dropping the old locked-settings `<dl>` in favor of `InfoSection`'s description (2026-08-11) | canonical |
| `app/src/components/forms/HandednessForm.astro` | Profile-page throwing-hand picker — roving-tabindex radiogroup writing `$store.boardInput.handedness` directly; RIGHT/LEFT options laid out on one line (`flex` row, `flex-1` each, `text-sm` label so the option text never wraps) (D206, 2026-08-11; single-line + InfoSection reuse #84, 2026-08-11); `InfoSection` wrapper and outer `<section>` stripped, radiogroup now labeled directly via `aria-label="Throwing hand"` and mounted inside `PlayerSettingsCard.astro`'s "Handed" row (2026-08-16) | canonical |
| `app/src/services/rulesets/quick-score.validator.ts` | Shared RECREATIONAL + QUICK_SCORE batch rules (no dart rows, turn-total bound, ROUNDS attempt cap) (2026-07-26) | canonical |
| `app/src/services/rulesets/tuod/tuod.validator.ts` | `TUOD_V1` config + batch validation, ladder-derived turn-total bound (2026-07-26) | canonical |
| `app/src/services/rulesets/visual-board.validator.ts` | Re-derives every ANALYTICS + VISUAL_BOARD dart from its coordinate via `classify()`, refuses a batch that disagrees; `isVisualBoardCapture` predicate shared with the engines (2026-08-05) | canonical |
| `app/src/services/rulesets/three-dart.validator.ts` | `createThreeDartValidator` — the mode-pair, dartless-turn, negative-score and visual-board assertions five three-dart validators share; `label`, `configSchema` and `dartlessIssue` stay per-game (2026-08-19) | canonical |
| `scripts/check-game-engines.sh` | Guard: every engine exports a factory, registers it, and has a validator | canonical |
| `scripts/check-game-wiring.sh` | Guard: every `registry.ts` key has a validator, a capability declaration, and — unless engine-only — data files, pages and Alpine registrations; engine-only derived from `games-visibility.ts`, both slugs derived, blind spots documented in its header (2026-08-19) | canonical |
| `scripts/check-refinement-coverage.sh` | Guard: refinements in `types.ts` match the refinement contract; blind spots documented in its header | canonical |
| `scripts/check-type-barrels.sh` | Guard: no inline exported `type`/`interface` in implementation files, every `types.ts`/`interfaces.ts` raised by its parent, no aliased or relative barrel **type** import deeper than the importing file's own folder or the area root (value imports exempt, D156); blind spots documented in its header (2026-07-26) | canonical |

## Player settings and app mode (2026-08-08)

Registered for discoverability, not as reading material — the contract lives in `06-API/04-Endpoint-Contracts.md` §Player Settings and the rationale in D195/D196.

| File | Answers | Status |
| ---- | ------- | ------ |
| `app/src/services/session-seats.service.ts` | The single place seat/participant agreement is asserted (seat count, one PLAYER, guest names, one seat per side, ruleset support, DartBot admission via `supportsDartbot`) plus `composeSeatFacts` (which now emits a `DARTBOT` branch carrying `level`/`seed`/`levelSource`) (D221, 2026-08-21; DartBot 2026-09-01) | canonical |
| `app/src/services/settings.service.ts` | `readSettings` / `writeSettings` — quick-score fallback for a player with no row, and the `capableRulesets` guard that refuses an uncapable mode pair; returns `ServiceResult`, never throws (D195) | canonical |
| `app/src/repositories/settings.repository.ts` | `findSettings` reads `v_player_settings`; `upsertSettings` writes `player_settings`, resolving mode keys to ids and creating the row lazily (D195) | canonical |
| `app/src/pages/api/players/me/settings.ts` | `GET`/`PATCH` route handlers over that service, in the frozen `ok`/`fail` envelope (D195) | canonical |
| `app/src/lib/client/api/settings.ts` | Browser client for the settings pair, following the sibling API clients' auth handling | canonical |
| `app/src/stores/settings.store.ts` | Alpine store holding the player's app mode, registered in `register-stores.ts`; optimistic save with rollback | canonical |
| `app/src/components/forms/AppModeForm.astro` | Profile-page mode picker — roving-tabindex radiogroup with a non-colour selection cue; title/explanation moved into `components/ui/InfoSection.astro` (2026-08-11) | canonical |
| `app/src/components/forms/SettingRow.astro` | Generic label + text-value/pencil-`Button`/input row; local `x-data` toggle (`editing`/`openValue`/`commit()`), `x-model`/`x-model.number` chosen via a spread `modelDirective` (2026-08-16); `commit()` snapshots the pre-edit value on open and guards blur/Enter — unchanged is a no-op, a required field left empty reverts without saving — since `saveExpr` (`$store.profile.save()`) round-trips all three profile fields and client-side-validates the full payload, so an unguarded blur on one row could throw on another row's empty required value (2026-08-16) | canonical |
| `app/src/components/forms/PlayerSettingsCard.astro` | Bordered card (reuses `InfoSection`'s own card classes, not the component) grouping display name, darts, weight (three `SettingRow`s) and the throwing-hand picker under a plain "Player settings" `h2` on `app/src/pages/profile/index.astro`, replacing the former always-open `DisplayNameForm`/`DartsConfigForm` (2026-08-16) | canonical |

## Cross-cutting mechanical guards (2026-07-28)

Guards not specific to the game-engine contract, registered here for discoverability.

| File | Answers | Status |
| ---- | ------- | ------ |
| `scripts/check-alias-sync.sh` | Guard: `tsconfig.json` compilerOptions.paths and `vitest.config.ts` resolve.alias never diverge (D113); `@styles` allowlisted as TS-only | canonical |
| `scripts/check-constraint-mirror.sh` | Guard: every live CHECK constraint on `exercise_stages`/`turns`/`darts` has a `// MIRRORS: chk_x` anchor in `app/src/pages/api/sessions/types.ts` (D149); bound agreement executed in `constraint-mirror.test.ts`, not by this script | canonical |
| `scripts/check-no-inline-comments.sh` | Guard: no `//` or non-JSDoc `/* */` comment inside a function/method body under `app/src/**/*.ts`; JSDoc `/** */` above a declaration stays exempt | canonical |
| `scripts/check-style-tokens.sh` | Guard: no `font-medium`, `{...rest}`, raw `bg-bg*`/`text-fg*`, Tailwind prefix-important (`!utility`), or leading-dash arbitrary (`-prop-[…]`) under `app/src/**/*.{astro,css}` | canonical |
| `scripts/check-file-locations.sh` | Guard: no `.ts` files directly under `components/`/`pages/` except `pages/api/**` | canonical |
| `scripts/check-agent-mirrors.sh` | Guard: every `CLAUDE.md` has an `AGENT.md` sibling holding the fixed pointer stub (D213) | canonical |
| `scripts/check-astro-class-composition.sh` | Guard: no `class:list` or manual class-join in `app/src/**/*.astro`; `cn()` only | canonical |
| `scripts/check-astro-conventions.sh` | Guard: every `x-show` has `x-cloak`; no HTML comments in `.astro` template regions | canonical |
| `scripts/check-context-map.sh` | Guard: every path referenced from a CLAUDE.md/README.md/context map exists; migration-range claims agree with `database/migrations/` (2026-07-23) | canonical |
| `scripts/check-doc-links.sh` | Guard: markdown links and path-like backtick refs across the canonical doc set resolve (D133) | canonical |
| `scripts/check-context-budget.sh` | Guard: this file's own `~Nk` token estimates don't drift from a chars/4 estimate (D133) | canonical |
| `scripts/check-decision-ids.sh` | Guard: every id across `decisions/**` is unique, none of the 163-id 2026-08-02 baseline has disappeared, every `Supersedes:` target exists, `DECISIONS.md` stays a router, every migrated row still hash-matches `scripts/decision-row-hashes.tsv` (D184+ out of scope by design), every `decisions/**.md` file is registered in the router's routing table; position-anchored to avoid darts `D18`/`D20` notation; blind spots documented in its header (2026-08-02; hash + registration checks 2026-08-03) | canonical |
| `scripts/decision-row-hashes.tsv` | Data file: id → sha256 of the 163 migrated rows' exact text at the 2026-08-02 split, read by `scripts/check-decision-ids.sh`'s row-integrity check | canonical |
| `scripts/check-findings-log.sh` | Guard: `FINDINGS.md` front matter carries `status:` and `highest-issued: F<n>`; every block has all seven fields; ids unique and within the mark; `Status:` is `Open`/`Raised` only (resolved findings are deleted, never restatused); every backticked `Evidence:` path still resolves; `Found:` dates are ISO (2026-08-19, D214) | canonical |

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
| `FINDINGS.md` | Open findings: defects and contradictions noticed but deliberately not fixed; append-then-delete, high-water-mark ids, guarded by `scripts/check-findings-log.sh` (2026-08-20); F34-F37 added from issue #169's final whole-branch review (2026-08-27); F39-F42 added from the engine-duplication-cleanup audit (2026-08-27); F54-F57 added from the DartBot phases 1-7 code review (2026-09-02); F45, F54-F57 closed by the DartBot setup-wiring fixes plan (2026-09-02) | canonical | ~11.2k |
| `decisions/architecture.md` | 20 decisions — domain model, activity, session, stage, turn, dart, ruleset, platform, dart zones, client keys, mode capability | canonical | ~2.1k |
| `decisions/database.md` | 16 decisions — schema, migration, table, column, constraint, index, view, Neon, seed (D222 owner-scoped dart views, 2026-08-21) | canonical | ~2.7k |
| `decisions/api.md` | 31 decisions — endpoint, contract, envelope, auth, middleware, idempotency, batch, Worker, player settings (D239 per-seat ROUNDS turn-count limit, 2026-08-27) | canonical | ~3.6k |
| `decisions/game-engine.md` | 46 decisions — engine, GameEngine, ruleset, scoring, checkout, fact log, 501, Score Training (D230 win-condition categories/`SEAT_CAPS`/`activeSeat()` completion predicate; D231 corrects which engines pass that predicate, 2026-08-22; D238 exclusive score-band tallying, 2026-08-27; D242 `visitScoreBandCounts`'s `sixtyPlus` band and `checkout-bust.module.ts`'s `checkoutAttemptCount`; D252 the bot play loop's generic infrastructure and the QUICK_SCORE fold, 2026-09-01) | canonical | ~21.9k |
| `decisions/testing.md` | 6 decisions — test, TDD, Vitest, mock, coverage, change-set test gate | canonical | ~1.4k |
| `decisions/frontend/architecture.md` | 19 decisions — layering, folder structure, suffix, barrel, type import, error mapping, API client, one-shape-per-game extraction | canonical | ~4.9k |
| `decisions/frontend/astro.md` | 21 decisions — .astro, component, prerender, routing, layout, cn(), props, frontmatter, PWA, manifest, icon, safe-area (D244 cross-cutting markup extraction inside D215's boundary, 2026-08-28) | canonical | ~5.1k |
| `decisions/frontend/alpine.md` | Alpine, stores, state, persist, recovery, x-data, x-show | canonical | ~3.1k |
| `decisions/frontend/style.md` | 11 decisions — style, CSS, token, Tailwind, primitive, typography, spacing, glass, surface, PWA, manifest, icon, safe-area, undo affordance, important-modifier ban | canonical | ~2.1k |
| `decisions/context-system.md` | 31 decisions — docs, context map, CLAUDE.md, skill, gate, check script, knowledge graph, CI, deploy, Prettier, format, husky | canonical | ~5.1k |

### Decision ledger migration tooling (2026-08-02, spent — 2026-08-03)

Registered for discoverability and provenance, not as reading material: `scripts/split-decisions.sh` ran once (2026-08-02) to produce the `decisions/**` tree above and now hard-fails if re-run (the ledger it reads from holds zero rows); `scripts/verify-decision-split.sh` proves that one run was lossless against an ephemeral `/tmp` snapshot and legitimately SKIPs once that snapshot is gone; `scripts/decision-map.txt` and `scripts/decision-front-matter.txt` were that run's inputs. None of the four is the ongoing guard — `scripts/check-decision-ids.sh` (registered under Cross-cutting mechanical guards below) is.

| File | Answers | Status |
| ---- | ------- | ------ |
| `scripts/split-decisions.sh` | Spent one-shot migration script: wrote `decisions/**` from `DECISIONS.md` + the map + the front-matter sidecar (2026-08-02) | historical |
| `scripts/verify-decision-split.sh` | Spent one-shot verifier: proves that migration was lossless against a `/tmp` snapshot (SKIPs once the snapshot is gone) | historical |
| `scripts/decision-map.txt` | Spent migration input: id → target-file assignment as it stood at the 2026-08-02 split | historical |
| `scripts/decision-front-matter.txt` | Spent migration input: per-target-file front-matter blocks as they stood at the 2026-08-02 split | historical |

---

## Context & history (repo root, `docs/`)

| File | Answers | Status |
| ---- | ------- | ------ |
| `README.md` | Repo orientation: project summary, folder layout, getting started (2026-07-14) | canonical |
| `.github/pull_request_template.md` | Default PR description scaffold + architecture checklist (2026-07-12) | canonical |
| `docs/CLAUDE.md` | Docs-tree editing rules | canonical |
| `docs/superpowers/{specs,plans,handoffs}/` | Point-in-time task designs and plans | historical |
| `app/CLAUDE.md` (+ `app/src/**/CLAUDE.md`) | App implementation rules, validation procedure; mid-task fallow/`npm run check` gate; Prettier pre-PR gate after writing-plans execution (2026-07-22) | canonical |
| `app/DEPLOYMENT.md` | Cloudflare Worker deploy guide: Neon prod setup, Worker secrets, GitHub Actions deploy vars, rollback, troubleshooting; `PUBLIC_NEON_AUTH_BASE_URL` no longer read by app code post-D172 (2026-07-29) | canonical |
| `AGENT.md` (repo root, `app/`, `app/src/db/`, `app/src/pages/api/`, `database/`, `docs/`) | Fixed pointer stub redirecting to the sibling `CLAUDE.md` in the same directory — not a rule source, never carries content (D213, 2026-07-15) | canonical |
| `.claude/skills/graphify/SKILL.md` | Graphify skill — build/query the codebase knowledge graph | canonical |
| `.claude/skills/context-maintenance/SKILL.md` | Context Maintenance procedure, invoked before claiming any task done (2026-07-28) | canonical |
| `.claude/skills/validate-app/SKILL.md` | `validate:app` sequence + mid-task gate condition for `app/` changes (2026-07-28) | canonical |
| `.claude/skills/run-all-gates/SKILL.md` | Dispatches the right `check-*.sh` scripts by changed area, reports each result explicitly (2026-07-28) | canonical |
| `.github/workflows/graph.yml` | CI-owned graph freshness: rebuilds `graphify-out/graph.json` (`GRAPH_REFRESH_STRICT=1`) on every push to `main`, then commits to `chore/graph-refresh` and opens/updates a PR with the delta — PR creation needs *Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"*; without it the branch is still pushed and the run summary carries a compare link (D186). On pull requests, posts a non-blocking delta comment via `scripts/graph-delta.py` without committing (2026-08-03; D186 2026-08-05) | canonical |
| `scripts/graph-delta.py` | Read-only helper: diffs two `graph.json` snapshots' node/link counts, normalising the volatile `built_at_commit` field away, for `graph.yml`'s PR body and delta comment | canonical |
| `graphify-out/graph.json` | Committed AST-only knowledge graph — CI-maintained (`.github/workflows/graph.yml` rebuilds on merge to `main`; local `scripts/refresh-graph.sh` remains available but is optional); generated, never hand-edited (2026-08-03) | generated |

---
