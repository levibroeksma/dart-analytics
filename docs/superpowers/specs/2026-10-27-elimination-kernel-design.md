# Elimination Kernel — Design

Date: 2026-10-27
Status: approved in brainstorming; plans: `docs/superpowers/plans/2026-10-27-elimination-kernel-pr1.md` (shipped), `docs/superpowers/plans/2026-10-28-elimination-kernel-pr2.md` (shipped)
Implementation: PR 1 (engine) shipped 2026-10-27; PR 2 (app wiring, section 6) shipped 2026-10-28
Parent: `2026-10-15-rule-kernels-design.md` (umbrella, §5 Elimination row, §8 item 2)
Siblings: `2026-10-17-track-kernel-design.md`, `2026-10-27-checkout-kernel-design.md`
Rules input: `docs/game-rules/rulesets/killer.md`

## 1. Goal

Build the Elimination rule kernel — "seats hold lives; a dart can change
any seat's lives or status; a seat at zero is out; the last seat standing
wins" — together with its first game, **Killer V1**, through to playable on
the board.

Unlike Track and Checkout, no shipped engine moves onto this kernel: every
game in the family is unbuilt. There is no oracle and no `legacy` copy; the
proof is TDD against the rules file (§8).

### Decided in brainstorming

| # | Decision | By |
| --- | --- | --- |
| E1 | Scope: kernel + Killer V1 only. Follow the Leader, Prisoner, Hare and Hounds get their own wave spec later; Prisoner and Hare and Hounds are re-checked there and may move family. | user |
| E2 | All the way through: kernel, engine, validator, seeds, setup, play screen, results, game card. | user |
| E3 | Killer V1 seats **exactly 2**. 3–4 seats are deferred until setup and the play screen seat more than two (`lib/game/guest-list.ts:19` allows one guest or bot; `SeatedPlayScreen` → `SplitScoreboard` draws two). The kernel stays N-seat and its tests cover 3–4 seats. | user |
| E4 | Effects apply **per dart**: a seat that becomes a Killer on dart 1 or 2 may take lives with the visit's remaining darts. | user (killer.md open question 1) |
| E5 | A hit on your own double **toggles** Killer status every time, including twice in one visit: Killer on the first, status lost on the second. | user (open question 2) |
| E6 | Seat numbers are **player-chosen** on the setup screen, 1–20, no two alike. | user (open question 3) |
| E7 | Kernel is dart-by-dart over one `SHARED` stage, bound to the existing game shell (`dartGameEngineClass`) as a `DartGameSpec`. No hand-written class. | Claude's call |
| E8 | No DartBot seat in V1: no bot strategy chooses among opponents' doubles. `RULESET_DARTBOT` omits `KILLER_V1`. | Claude's call |
| E9 | No career statistics page in V1; the results modal carries the rules file's Result. `STATS_TAGS` gets `["board"]` (as Cricket), since the record is total over keys. | Claude's call |

## 2. Current state

- `match-outcome.module.ts`'s `eliminationWinner(seats)` already returns the
  last survivor for N seats (null while ≥2 survive). The umbrella's
  `lastStanding` outcome is this function; no new outcome is added.
- `dart-engine-shell.module.ts` builds every single-stage dart engine from a
  `DartGameSpec`. All shell-bound games are `PER_SEAT`; Killer is the first
  `SHARED` one. The shell's `exerciseBlockStage()` is ownership-neutral and
  the spec owns `activeParticipantRef`, so no shell change is expected
  (verify in PR 1; if one is needed it is additive).
- Engine config is the ruleset config plus `seats` (as Bob's 27:
  `config.seats`), so per-seat settings ride the configuration snapshot.
- `session-seats.service.ts` `SEAT_CAPS` defaults an unlisted key to 1.

## 3. Kernel contract

`app/src/modules/game/elimination-kernel.module.ts`; types in
`modules/game/types.ts`, rules interface in `modules/game/interfaces.ts`
beside `TrackRules` / `CheckoutRules`.

```ts
interface EliminationSeat<TExt> {
  participantRef: string;
  sideKey: string;
  lives: number;           // ≥ 0
  out: boolean;            // lives reached 0
  ext: TExt;               // game-owned: Killer status, number, tallies …
}

interface SeatChange<TExt> {
  participantRef: string;  // any seat, the thrower included
  livesDelta?: number;     // ≤ 0 in V1; clamped so lives never go below 0
  ext?: TExt;              // replaces the seat's ext
}

interface EliminationRules<TExt> {
  readonly startingLives: number;
  readonly dartsPerVisit: number;
  initExt(seat: SeatFact, index: number): TExt;
  /** Every change one dart causes, judged on the seats as they stand before it. */
  onDart(
    thrower: EliminationSeat<TExt>,
    seats: readonly EliminationSeat<TExt>[],
    dart: DartFact,
  ): readonly SeatChange<TExt>[];
}

interface EliminationMatch<TExt> {
  seats: EliminationSeat<TExt>[];
  outOrder: string[];                  // participantRefs, first out first
  status: "IN_PROGRESS" | "COMPLETE";  // engine status, as MatchOutcome
  winningSideKey: string | null;       // eliminationWinner over { sideKey, failed: out }
  activeParticipantRef: string;
}
```

- Export: `foldElimination(turns, seats, rules) → EliminationMatch<TExt>`,
  walking every dart of every turn in order (open turn included).
- After each dart: apply changes in order; a seat reaching 0 becomes `out`
  and is appended to `outOrder`; `eliminationWinner` (seats mapped to
  `{ sideKey, failed: out }`) decides the match. Darts after `COMPLETE` cannot exist — the spec's `refusal` blocks them.
- Changes to an `out` seat are ignored by the kernel (a policy need not
  check), so "a dart in the double of a seat already out does nothing"
  holds for every game.
- **Rota:** a visit closes at `dartsPerVisit` darts or when the match
  completes. The next visit goes to the next seat in seat order that is not
  `out`, skipping out seats. Seat 0 opens. This is the spec's own
  `activeParticipantRef`; `seat-rota.module.ts`'s lockstep `activeSeat` is
  not used.
- **Fallow:** fold cognitive complexity ≤ 15; branching lives in policies.
- **Refined by the PR 1 plan (status note, 2026-10-27):** `dartsPerVisit`
  left `EliminationRules` — a visit is open while its turn has no
  `completedAt`, and the 3-dart limit lives in the spec's `isVisitOpen`;
  `onDart` takes a `DartObservation`. PR 1 also brought the reference seed
  (`0054`, `0007` rows), because the capability parity test ties
  `RULESET_CAPABILITIES` to the seed (D501).

## 4. Killer V1 binding

`app/src/modules/game/killer.engine.module.ts` — a `DartGameSpec`, key
`KILLER_V1`, `stageOwnership: "SHARED"`.

Config (`lib/game/rulesets/types.ts`, snake_case like its peers):

```ts
KillerConfig = z.object({
  lives: z.literal(3).default(3),
  seat_numbers: z.array(z.number().int().min(1).max(20)).default([]), // seat order
}).strict();
```

`seat_numbers[i]` belongs to `config.seats[i]`. The schema defaults it to
`[]` so the seeded template (`lives` only) parses; the validator and setup
enforce length = seat count and no duplicates (Claude's call).

Kernel-config row:

| Setting | Killer V1 |
| --- | --- |
| `startingLives` | `config.lives` (3) |
| `dartsPerVisit` | 3 |
| `initExt` | `{ number: seat_numbers[i], killer: false, livesTaken: 0, dartsToKiller: null, dartsThrown: 0 }` |
| `onDart` | `killerHit` policy (below) |
| Outcome | `eliminationWinner`, from the kernel |

`killerHit(thrower, seats, dart)`, in `elimination-policies.ts`:

1. Every dart increments the thrower's `dartsThrown`.
2. Not a `DOUBLE` hit on 1–20 → nothing else. (Inner bull is not a seat's
   double.)
3. Double of the thrower's own number → toggle `killer` (E5); first time
   on, set `dartsToKiller = dartsThrown`.
4. Double of another seat's number, thrower is Killer → that seat
   `livesDelta: -1`; thrower `livesTaken + 1`. Not Killer → nothing.

State projection (`KillerState extends ShellState`): per seat `number`,
`lives`, `killer`, `out`, `livesTaken`, `dartsToKiller`; match `status`,
`winningSideKey`, `outOrder`, `activeParticipantRef`. Everything derived,
nothing stored.

`DartGameSpec` fields: `fold` → `foldElimination` + projection; `refusal`
→ "game over" once `COMPLETE`; `intent` → `NO_INTENT` (rules: intended =
nothing stored); `isVisitOpen` → `darts < 3 && status === IN_PROGRESS`;
`wouldComplete` → fold with the observation appended. `totalScore` stays
the darts' board-score sum (no `closedVisitTotal`).

## 5. Capture (Hard Invariants)

- **Capture / input mode:** `RECREATIONAL + DETAILED_DARTS`,
  `ANALYTICS + VISUAL_BOARD` (`capabilities.ts`). No QUICK_SCORE.
- **Stage type:** one `EXERCISE_BLOCK` stage, `SHARED` ownership.
- **`turns`/`darts`:** one `turns` row per visit (≤3 darts, the thrower's
  `participantRef`); one `darts` row per dart, intended columns null, hit =
  number + zone, `score` = board score. No new columns; no migration.
- **Seat numbers:** configuration snapshot (`seat_numbers`), never a fact.

## 6. App wiring (PR 2)

Status: PR 2 shipped 2026-10-28.

Full touch list of `07-Frontend/09-Adding-A-Game.md`, one commit (wiring
gate). Route slug and code slug: `killer`.

| Area | Killer |
| --- | --- |
| Seeds | `database/seeds/00NN_killer_game_engine_reference.sql` (game type `KILLER`, `KILLER_V1`, template with `lives: 3`); capability rows in `0007`; verification scripts |
| Seat cap | `SEAT_CAPS.KILLER_V1 = 2`; validator rejects ≠ 2 seats (Killer has no solo form) |
| Validator | `createThreeDartValidator` composed with: seat count 2, `seat_numbers` length = seats, distinct |
| Setup | `createPresetSetupController` + `configOverrides(ctx)` → `seat_numbers`. A number belongs to the person, not the position: `configOverrides` runs *before* `starterFirst` reorders seats, so the plan must carry each person's number into the final seat order (starter step) and through `runPlayAgain` via `buildOverrides` (`play-lifecycle.ts`), where each person keeps their number (Claude's call). Form: one 1–20 number picker per seat, duplicates blocked; Start disabled until a guest is seated. `allowGuests`, no DartBot. |
| Play | `SeatedPlayScreen`: per seat number, lives, Killer badge, out. Input: reuse an existing number + ring keypad (Cricket's `RingKeyRow` + 1–20 grid + bull + miss shape) — builder's choice, recorded in the plan |
| Results | Winner, out order, lives taken per seat, darts to become Killer (`—` if never). A session ended without a survivor (abandoned) uses the app's existing abandon flow; no winner shown (Claude's call) |
| Card | `games-visibility.ts` entry; tags from the rules file |

## 7. Rules-file updates (PR 1, via `authoring-game-rules`)

`killer.md`: Multiplayer row → 2 seats V1; new Deferred row "3–4 seats —
Blocked on: setup and play screen seat two" (E3); open questions 1–3
answered per E4–E6 and removed; config Players row → 2, locked.

## 8. Proof

TDD (`app/CLAUDE.md`), no oracle:

- Kernel unit tests: lives clamp, out order, rota skips out seats at 3 and
  4 seats, visit closes on match end mid-visit, changes to out seats
  ignored, rehydration via `create(config, prior)` equals live state.
- Killer engine tests: one per V1 feature row and per E4/E5 ruling;
  undo across a Killer toggle and across an elimination.
- Golden step-trace for one full 2-seat game.
- Validator, setup and play data tests per the touch list.

**Gates per PR:** `npm test`, `npm run check` (0 hints), fallow, all
`check-*.sh` including `check-engine-kernels.sh` (new row
`killer.engine.module.ts | ELIMINATION | KERNEL_BOUND`),
`check-game-wiring.sh`, `check-test-coverage.sh`, `validate:app`.

## 9. Sequencing

| PR | Brings |
| --- | --- |
| 0 | this spec |
| 1 | `elimination-kernel.module.ts`, `elimination-policies.ts` (`killerHit`), `EliminationRules`; `killer.engine.module.ts` engine-only (registry + validator same commit, `capabilities.ts`, `STATS_TAGS`, `RulesetVersionKey`); `engine-kernels.txt` row; `killer.md` updates; D-entry (kernel form, E3, E7–E9); Pattern 18 Elimination row → `built` |
| 2 | seeds, `SEAT_CAPS`, setup, play, results, card (§6) |

## 10. Docs per PR

- Pattern 18 §Rule-kernel families Elimination row (PR 1).
- `app/src/modules/game/CLAUDE.md`: one Elimination bullet (PR 1).
- `09-Adding-A-Game.md`: note Killer as the `SHARED`-stage shell exemplar (PR 2).
- `00-File-Inventory.md` rows for new modules; `00-Context-Map-History.md`.
- `decisions/game-engine.md`: one D-entry in PR 1 (id via
  `bash scripts/next-decision-id.sh`).

## 11. Out of scope

- 3–4 seat setup and scoreboard (E3) — its own series.
- Follow the Leader, Prisoner, Hare and Hounds (wave spec).
- Every V2+ and Deferred Killer row (Survivor, 5-Lives, Blind, Team, Killer Cricket, self-hit penalty).
- DartBot (E8); career statistics (E9).
- Schema changes (none needed).

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Kernel overfits Killer | contract has no Killer terms; 3–4 seat tests; wave spec re-checks fit before adding games |
| First `SHARED` shell engine hits an unseen shell assumption | PR 1 test drives undo, rehydrate and visit close through the shell; any shell change additive |
| Seat numbers misaligned with seat order after the starter step or play-again | numbers mapped by person into final order; setup and play-again tests cover a starter swap |
| Visit close on mid-visit win leaves an open turn | kernel + shell test: winning dart stamps `completedAt` |
