# Design: Profile display name + darts config

Status: approved. Author: agent, brainstorming session, 2026-08-15.

## Problem

Profile page has no way to rename yourself (display name is set once at provision, no edit path) and no way to record which darts / weight you play with.

## Scope

- Editable display name (existing `players.display_name` column, new write path)
- New darts equipment fields: free-text darts description, weight in grams
- Out of scope: multiple dart sets, structured brand/model fields, using equipment data in gameplay/analytics

## Data model

Extend `players` (the table `display_name` already lives on — profile identity, not a gameplay default):

- `darts_description TEXT`, nullable. CHECK `darts_description IS NULL OR length(trim(darts_description)) > 0`, mirroring `chk_players_display_name_not_empty`.
- `darts_weight_grams SMALLINT`, nullable. CHECK `darts_weight_grams IS NULL OR (darts_weight_grams > 0 AND darts_weight_grams <= 100)` — covers steel/soft-tip dart weights with headroom.

New migration `0022_player_profile_read_model.sql`:
- `ALTER TABLE players ADD COLUMN` x2 + both CHECK constraints
- `CREATE VIEW v_player_profile AS SELECT id AS player_id, display_name, darts_description, darts_weight_grams, updated_at FROM players;`
- `migrate:down` drops the view, then the constraints, then the columns

Rejected alternatives:
- `player_settings` — wrong semantics; settings are gameplay-mode defaults copied onto sessions at start, equipment is not a game-start default.
- New `player_equipment` table — premature; the ask is one current dart set, not a collection. YAGNI.

## API

New sibling route to the existing `/api/players/me/settings`: `GET`/`PATCH /api/players/me`.

- `GET /api/players/me` — reads `v_player_profile`, returns `{ displayName, dartsDescription, dartsWeightGrams }`.
- `PATCH /api/players/me` — replaces all three fields (no partial update, same convention `/me/settings` already established). `displayName` required non-empty; `dartsDescription`/`dartsWeightGrams` nullable (null clears the field). Request schema mirrors the two new CHECK constraints (weight bound, non-empty-when-present), per the "request schemas mirror column CHECK constraints" rule.

Docs: `06-API/00-Overview.md` (route surface + read-contract table, version bump) and `04-Endpoint-Contracts.md` (new `## Player Profile` section, version bump) — same doc-first pattern used when `/me/settings` shipped.

## Frontend

New `profile` Alpine store (mirrors `settingsStore`: `displayName`/`dartsDescription`/`dartsWeightGrams`/`loading`/`error`, `init`/`load`/`save`), registered in `register-stores.ts`.

Two new cards on `pages/profile/index.astro`, both backed by the same store/endpoint (whichever card's Save is clicked sends the store's current full profile — no partial-PATCH complexity in the UI):

- `DisplayNameForm.astro` — `InfoSection` heading, `Input` + `Button` (Save), read/writes `$store.profile.displayName`.
- `DartsConfigForm.astro` — `InfoSection` heading, two `Input`s (darts text, weight number) + `Button` (Save), read/writes `$store.profile.dartsDescription` / `dartsWeightGrams`.

Reuses `Input.astro`/`Button.astro`/`InfoSection.astro` — no new primitives.

## Testing

Mirrors the existing settings stack's test files (repository, service, route, client, store) — no engine/gameplay code touched, so no new game-engine or validator tests apply.
