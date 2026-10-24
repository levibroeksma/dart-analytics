# Cricket DartBot (marks strategy) — Design

Date: 2026-10-24. Rules: `docs/game-rules/rulesets/cricket.md` (row "Vs DartBot"). Bot architecture: `docs/architecture/08-DartBot.md`. Precedents, read first: `docs/superpowers/specs/2026-10-24-cricket-v2-design.md` (the guest-only 1v1 this extends), `2026-09-07-shanghai-v2-guest-dartbot-design.md` (a bot seat on a guest-capable V2 key).

## 1. Intent

Cricket V2 shipped guest-only because no DartBot strategy could aim at an objective. This adds the first strategy that chooses its own target, so a Cricket V2 seat can be a DartBot.

Locked with the user (2026-10-24):

- Scope is Cricket V2 only. The strategy and view are written generically; Tactics V2 is a follow-up that reuses them.
- Policy is opponent-aware, as a strict ladder (§3). Decision-degrading by `level` is out: `level` (1–15, default 8) changes aim noise only, through the existing skill profile.
- No new ruleset key. A bot seat does not change the rules; it is a seat type on `CRICKET_V2`.

Assumptions (not stated by the user, open to veto): no migration or schema change (seat admission and the participant write path shipped in DartBot phases 4–5); the objective order is fixed 20, 19, 18, 17, 16, 15, bull in every tier, so the bull, the hardest target, is last even though it scores 25.

Success: a human picks DartBot as the Cricket V2 opponent, plays to a win, undoes, resumes and replays, with the same bot behaviour as 501 and Bob's 27.

## 2. Classification

Execution model: game. Kernel: MARKS. Entry point: standalone. Additive and seat-conditional (`1v1`); no shipped rule changes. One decision block in `decisions/` (id from `scripts/next-decision-id.sh`) records the first choosing strategy and the opponent-aware ladder.

## 3. Policy

Objectives are ordered 20, 19, 18, 17, 16, 15, bull. Closed means three marks. For each dart, the first rule that matches wins:

1. **Block:** the first objective with `opponent ≥ 3` and `own < 3`.
2. **Score:** the first objective with `own ≥ 3` and `opponent < 3`.
3. **Close:** the first objective with `own < 3`. Tier 1 took every objective with `opponent ≥ 3`, so this one has `opponent < 3`.
4. **Fallback:** treble 20. Reachable only when every objective is closed by both seats, and the engine has already ended that game, so this is defensive.

Aim: treble for a number, inner bull for the bull. The policy reads no points, so the view carries none. It is re-derived from the view before every dart, so a miss corrects itself with no state held across a visit (the X01 contract).

## 4. Module

- `app/src/modules/dartbot/interfaces.ts`: `MarksView = { objectives: readonly { targetNumber: number; own: number; opponent: number }[] }`, in priority order, bull as 25. Flat: no engine types cross (08-DartBot.md §Import direction).
- `app/src/modules/dartbot/strategy/marks.strategy.module.ts`: `chooseTarget(view: MarksView): ThrowIntent`, pure, no RNG. The bull literal is local, as in `dictated.strategy.module.ts`.

## 5. Wiring (app side)

- `lib/game/rulesets/capabilities.ts`: `RULESET_DARTBOT.CRICKET_V2 = true`. `SEAT_CAPS.CRICKET_V2` is already 2. The `RULESET_DARTBOT` doc comment names Cricket V2 and the marks strategy.
- **Setup key (the trap).** `cricket-setup.data.ts` picks `CRICKET_V2` on `ctx.guests.length > 0`, and a bot is not in `guests` (`ctx.bot: { level } | null`). Unchanged, a bot session would create under `CRICKET_V1` (cap 1) and 422. The key becomes `ctx.guests.length > 0 || ctx.bot !== null`, pinned by a test for guest, bot and solo.
- `CricketSetupForm.astro`: `<UserSection allowGuests allowDartbot={supportsDartbot("CRICKET_V2")} />` as in `Bobs27SetupForm.astro`; info copy gains the DartBot sentence.
- `cricket-play.data.ts`, following `bobs27-play.data.ts`:
  - `marksViewFor(state, botRef)`: flattens `CricketState` into `MarksView` (own marks from the bot seat, opponent marks from the other seat, objectives from `CRICKET_OBJECTIVES`).
  - `throwBotDart`: seeded RNG at `botDartIndex`, `skillProfileForLevel(botSeat.dartbot.level)`, `chooseTarget(marksViewFor(...))`, `throwDart`. It returns `{ observation, pacing: BOT_PACING }`.
  - `maybeRunBotVisit` via `playRunBotVisualBoardVisit`, called after init/resume and after each human visit (the same three call sites as Bob's 27), plus the `botThrowing`/`botFlight` state and undo through `undoBotAwareVisit`.
- Capture is `DETAILED_DARTS`, `VISUAL_BOARD` only, so the bot emits a `DartObservation` per dart, with no QUICK_SCORE scratch-engine fold. Bot darts persist on the DARTBOT `participantRef` exactly as in the other bot games; replay and stats exclude them already.

## 6. Determinism and persistence

Each dart is drawn from `createDartRng(seed, botDartIndex(turns, botRef))`, so an undone or resumed bot visit re-throws identically (08-DartBot.md §Determinism and Replay). The target is a function of the folded state only. No stored fact is added; points, dead numbers and the winner remain folded from dart facts.

## 7. Docs

- `08-DartBot.md`: coverage table row `CRICKET_V2` (`DETAILED_DARTS · VISUAL_BOARD`, `PER_SEAT`, Marks, `DartObservation` per dart); the strategy-layer prose names the first strategy that chooses its own target; `MarksView` joins §GameView contracts.
- `cricket.md`: the "Vs DartBot" Features row and Later-versions entry move from `V2+` to `V3` via the `authoring-game-rules` amend path (`references/amending.md`), keeping its Glossary term; the unblocked reason is recorded. `check-game-rules.sh` must pass.
- `docs/architecture/00-File-Inventory.md` needs a row only if a file is added under a registered area; the plan checks. `00-Context-Map-History.md` gets the version entry.
- One decision block (§2).

## 8. Testing (TDD, failing test first)

1. Strategy table: one case per ladder tier (block, score, close), tier precedence (block over score over close), the fixed order inside a tier, the bull ring, and the fallback.
2. Adapter: bot seat 0 and seat 1; a closed objective; a dead objective; the bull as 25.
3. Capability, `SEAT_CAPS` and registry parity tests gain the `CRICKET_V2` bot entry (the Cricket V2 spec's "`RULESET_DARTBOT` has no `CRICKET_V2`" test is rewritten, not deleted).
4. Setup: guest → V2, bot → V2, solo → V1; the form passes `allowDartbot`.
5. Play loop: a bot visit records darts on the bot ref; the human regains control after three darts; undo returns to the human's last visit; resume mid-bot-visit re-throws identically.
6. Seeded simulation: N full bot-vs-bot games per level pair, asserting a level-12 bot beats a level-4 bot and that every game terminates. N is set in the plan so the test stays under two seconds.
7. **Dupes:** record `npx fallow dupes --mode semantic --min-tokens 30` before Task 1 and compare per task. `throwBotDart` in the new code must not clone the Bob's 27 or 501 copies; if it would, the shared part is extracted into `play-bot-seat.ts` for the new caller only, and refactoring the existing callers is filed as a discovered-work issue, not done here. Fallow health (CRAP ≤ 30, cyclomatic ≤ 20) runs on every task.
8. Visual check (Playwright, mocked API, 390×844): pick DartBot in setup, watch a bot visit animate, undo back to the human.

## 9. Out of scope

Decision-degrading by level; points-aware or expected-value play; Tactics V2 bot; a bot seat on `CRICKET_V1` (solo); DartBot auto level (D-K); recalibrating the level curve; any variant in `cricket.md` §Variants; any change to the engine, the fold or the schema.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| A bot session creates under `CRICKET_V1` and 422s | The key tests cover bot, guest and solo (§5) |
| The strict ladder plays visibly oddly (blocks while far ahead) | Accepted for the baseline; the view and strategy seam stay, so a later version adds a rule or the decision axis without interface change |
| The bull is last in every tier, so a bot behind on points may never score on it | Accepted; stated in §1 and in the 08-DartBot.md row |
| `throwBotDart` cloned a third time | Dupes gate (§8.7) |
| Bot re-throw differs after undo or resume | Determinism test (§8.5) |

## 11. Review focus

- Block tier takes precedence over score and close.
- Seat order: whichever seat the bot takes, the first thrower is right and the bot visit starts only on its turn.
- The bot's winning dart ends the game with no further bot dart (the Tactics V2 lesson).
- Undo of a bot visit, mid-visit resume, and replay of a bot game.
- A bot session is created on `CRICKET_V2`, and solo and guest sessions are unchanged.
