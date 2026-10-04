# Heatmap target picker (Group B)

Scope: Doubles Training and Bob's 27 on `/statistics`. Both are `intent-stored`, so the server already accepts `heatmap?target=<ZONE>:<n>`.

## Decisions

- Same heatmap section for every board game; the picker shows only when the game's type key is in `HEATMAP_TARGET_GAMES`.
- Options: "All targets" (`null`) + the 21 doubles-path keys (D1..D20, BULL), labelled via `targetLabel`. Same keys Bob's 27 survival walks.
- State lives in `gameHeatmapSection()` (`target: string | null`). `$watch("target")` reloads; a game change resets it to `null`.
- `target` flows into `loadGameSection` range; it already joins the cache `paramsKey`. One request per target.
- Doubles Training and Bob's 27 move into `HEATMAP_ONLY_LAYOUTS` (the set name is kept; its comment drops "no target picker yet").
- Out of scope (Group C): Singles, Shanghai, ATC (`intent-derived`; server rejects `target`).
- Persistence: no change; reads existing stored intent via the `heatmap` section.
