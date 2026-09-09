# Trivia

This folder holds descriptions of standalone practice/study tools — these
are **not** dartboard games played under the `game_types` model.

The category landing page and its architecture precedent are set in
`docs/architecture/10-trivia.md` (Checkout Trivia — architecture written,
not yet implemented).

**Quick Subtract** is built. See
`docs/superpowers/specs/2026-09-09-quick-subtract-trivia-design.md` for its
design and `decisions/frontend/architecture.md` (D261) for the architecture
decision — a `modules/trivia/` OOP tool (class-based, unlike Checkout
Trivia's plain functions) outside the `GameEngine` contract, no `game_types`
row, no persistence. A future trivia tool follows this same precedent
rather than re-deciding it.

`checkouts.md` (a target-number → dart-route selection drill) has its
architecture written (`10-trivia.md`) but remains unbuilt; no implementation
plan exists yet.
