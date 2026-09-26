<!--
status: canonical
scope: architecture/statistics/replay
read-when: building or changing the per-session game replay route or its endpoint
updated: 2026-09-26
-->

# Statistics — Game Replay

> **Version:** 1.0.0 (2026-09-26, D365)
>
> Full, paginated replay of one session. Shared query rules and caching:
> `00-Overview.md` §5/§7. Status: **designed, not built.**

---

# 1. Route

A dedicated per-session page, linked from every game page's session list and
from sections that point at one session (best leg, highest checkout). Its URL
form (dynamic segment vs query parameter on a prerendered page) follows
`07-Frontend/01-Rendering-Strategy.md` and is fixed in the replay phase's spec.

---

# 2. Endpoint

`GET /api/statistics/sessions/:sessionId/replay?cursor=&limit=`

- Owner-scoped: another player's session → `NOT_FOUND`.
- Completed and abandoned sessions both replay; an active session → `NOT_FOUND`
  (resume is `v_active_sessions`' job).
- **Pages of turns**, ordered by stage path then turn sequence. `limit` defaults
  to one leg-sized page (e.g. 30 turns) and is capped server-side.
- The first page (no `cursor`) carries the **header**:
  configuration snapshot, ruleset version, input mode, stage tree, participants,
  status and outcome, `context_key`, `activity_id` (links a routine-step game to
  its training run). Later pages carry turns and darts only.
- Each dart: dart number, hit target + zone, intended target + zone (when stored),
  score, coordinates.
- `from`/`to` do not apply (the session id is the scope); every other
  statistics endpoint requires them.

Replay reproduces the stored facts and the stored snapshot — never current
templates or rulesets (`05-Views/00-Overview.md` §Runtime Replay Rules).
Derived per-turn values the UI shows (remaining score, active target) are
computed client-side by folding the pages through the ruleset's engine, the
same way the play page does.

---

# 3. Cost

- Pages are immutable once the session is terminal: cached forever in the
  `replayPages` store, `Cache-Control: immutable` on the response.
- Only the pages the user scrolls to are fetched; a long timed session never
  loads in one payload.
- Backed by `v_game_replay` (widened with coordinates and `context_key`) or a
  sibling view, per `00-Overview.md` §10.
