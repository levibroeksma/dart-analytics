# Marks statistics page — design

Status: draft for owner approval · Date: 2026-11-20

## Intent

The MARKS family is next after CHECKOUT (D565). Its games are Cricket (`CRICKET_V1` solo, `CRICKET_V2` 1v1), Tactics (`TACTICS_V1`, `TACTICS_V2`) and Mickey Mouse (`MICKEY_MOUSE_V1`), and today they show only the heatmap layout. As with Ace and Checkout, the owner wants the page to **measure improvement over time**: more marks per round, fewer darts to close out, fewer wasted darts and more wins, each compared with the previous period. A dart's marks follow from where it landed under each game's own rules, so no aim needs storing. Wins and points depend on the opponent's darts too: the `v_stats_*` views hold the owner's darts only, but `v_game_replay` (0023, 0053) holds every participant's darts in the owner's sessions, so no migration is needed (owner decision, 2026-11-20).

## Goals

- **A new server section, `marks`**, for the three games. It replays each session through the game's own marks fold (`foldMarks` with `CRICKET_RULES`, `TACTICS_RULES` or `MICKEY_MOUSE_RULES`) and emits, per bucket, the owner's:
  - darts
  - effective marks
  - wasted darts
  - per-objective marks and landed darts
  - single, double and treble mark counts
  - finished close-outs with their dart counts
  - and, for 1v1 sessions: games finished, games won and points.
- **A dedicated Marks layout** for the five ruleset versions, over the page Period select, in this order:
  1. Completion tile.
  2. **Four comparison tiles**, each showing the current period's value and its change against the preceding period of equal length:
     - **Marks per round:** effective marks ÷ darts × 3, matching the game screen's "Marks / round" (`marksPerRound`). Effective marks are capped at 3 per objective, so marks scored as points do not count.
     - **Darts to close out:** mean darts at the dart that closed the owner's last open objective, over sessions where the owner closed every objective.
     - **Wasted darts:** darts that added no effective mark and scored no points ÷ darts.
     - **Win rate:** 1v1 sessions the owner won ÷ finished 1v1 sessions. When the period has no 1v1 session, the tile shows "Solo games only".
  3. **Marks by objective:** one row per objective in the game's own set. Columns: objective, marks, darts landed.
     - Cricket: 20–15 and the bull.
     - Tactics: 20–15, the bull, Doubles and Triples.
     - Mickey Mouse: its twelve categories.
  4. **Ring mix:** the share of single, double and treble marks among effective marks.
  5. **Points per round:** 1v1 only. Owner points ÷ owner darts × 3, with its change against the preceding period. Hidden when the period has no 1v1 session.
  6. The heatmap and the session list.

## Non-goals

- Aim or hit rate per objective: darts carry no intent.
- Bot or guest statistics. Opponent darts feed the fold only.
- Per-session trend charts, opening order, and darts-to-close per objective.

## Anti-goals

- A mark count that differs from the game screen's for the same session.
- A second copy of any game's marks rules: the section must call the engines' rules, not re-derive marks from rings.
- A change shown from too few: a change shows only when both periods have at least `MIN_TARGET_SAMPLE` (30) in that tile's denominator. The denominators are:
  - Marks per round: darts.
  - Darts to close out: close-outs.
  - Wasted darts: darts.
  - Win rate: finished 1v1 sessions.
  - Points per round: darts in 1v1 sessions.

  Below that the tile shows its current value alone. All Time shows no change.
- Reading another player's history: only sessions the owner played are read, `v_game_replay` filtered by the requesting `player_id`.

## Data

- **No migration.** The section reads `v_game_replay` (every participant's darts, scoped to the owner's sessions by `player_id`) for the sessions `v_stats_session_facts` selects in the request's scope.
- **Fold input:**
  - Solo sessions replay from the owner's darts as other server sections do.
  - 1v1 sessions replay both seats from `v_game_replay`, so points, dead numbers and the winner match the game.
- **Owner seat:** the seat whose participant is the requesting player; the engine's `winnerParticipantRef` decides a win.
- **Reads:** `marks` is bucketable, but the page uses two un-bucketed reads (current and preceding window), the Ace and Checkout pattern (`comparisonSection`, `periodComparison`). The cards read over the current window.

## Constraints

- Layout switch:
  - Add a new `MARKS_LAYOUTS` set: `CRICKET_V1`, `CRICKET_V2`, `TACTICS_V1`, `TACTICS_V2`, `MICKEY_MOUSE_V1`. All five leave `HEATMAP_ONLY_LAYOUTS`.
  - Add a branch in `pages/statistics/index.astro`.
- `marks` is registered in `section-registry.ts`, gated to `games: ["CRICKET", "TACTICS", "MICKEY_MOUSE"]` with `computeSite: "server"`. Add a `PAGE_ORDER_OVERRIDES` entry if the page order needs one.
- Reuse:
  - `StatTileRow.astro`, `AimTable.astro`
  - `ratioTile`, `comparisonSection`, `periodComparison`
  - `formatRate`, `formatPointDelta`
  - the Ace and Checkout tile copy
- The in-game `marksPerRound` and `effectiveMarks` (`marks-close.module.ts`) are the definitions. Import them; do not copy them.
- Repo gates:
  - a test per changed runtime `.ts`
  - type-barrels, check-dupes, no inline comments
  - astro check 0/0/0, format
  - context-budget
  - quality ratchet
  - `statistics-sql.itest.ts` where a database is available
- Docs in the same change:
  - `10-Statistics/01-Section-Catalog.md` (new section row, Marks layout paragraph, game rows)
  - `10-Statistics/00-Overview.md` if the section list is named there
  - the game-rules rows for Cricket and Tactics: their "statistics section" rows say a view and migration are needed; mark them shipped with no migration
  - File Inventory, component inventory, context-map history
  - a pending decision record in `decisions/api/`
- Ask the owner about the design sync (D524) before the PR.

## Left to the builder

- File and factory names.
- One `marks` section, or `marks` plus a separate duel section.
- Whether the cards are one component or several.

## Marked as the author's calls

- Marks per round and effective marks follow the game screen (owner, 2026-11-20).
- Wasted dart: adds no effective mark and scores no points.
- Darts to close out counts sessions where the owner closed every objective, whether or not they won.
- Mickey Mouse's double-dip counts as the game counts it (two effective marks from one dart where its rules say so).
- Points per round and Win rate come from 1v1 sessions only, and are hidden or marked "Solo games only" when there are none.
- The 30 floor applies to the change, not to the current value.
