#!/usr/bin/env bash
# Game-wiring gate — the six shared registries a new game must be added to,
# checked against each other. `scripts/check-game-engines.sh` proves an engine
# has a validator and declared capabilities; this proves the rest of the row:
# that a game reachable from the games page has data files, pages, and Alpine
# registrations, and that an engine-only ruleset has none of them.
#
# Driven from app/src/services/rulesets/registry.ts. For every key in it:
#   1. Validator file  — the path the registry imports resolves on disk.
#   2. Capabilities    — the key is declared in RULESET_CAPABILITIES.
#   3a. Visible games (the key appears in games-visibility.ts's GAME_CARDS):
#       both <code-slug>-{setup,play}.data.ts exist; both
#       pages/games/<route-slug>/{setup,play}/index.astro exist; each page's
#       x-data name is registered by Alpine.data(...) in
#       register-route-data.ts and imported there from the matching data file.
#   3b. Engine-only games (absent from GAME_CARDS): neither data file exists
#       and no pages/games/<code-slug>/ directory exists. Half a row is a
#       failure whichever half it fell on.
# Plus the reverse direction: every GAME_CARDS key has a registry entry, and
# every @lib/game/<slug>-setup.data import in register-route-data.ts belongs
# to some registry key.
#
# TWO SLUGS, BOTH DERIVED, NO TABLE. The code slug is the validator's own
# directory (services/rulesets/one-twenty-one/ → one-twenty-one); the route
# slug is read from the href GAME_CARDS already declares (/games/121/setup →
# 121). They differ for exactly the games whose real name starts with a digit,
# because a TypeScript identifier cannot. Deriving both means the gate never
# needs a mapping of its own to fall out of date.
#
# WHAT THIS GATE CANNOT DO, stated plainly so nobody mistakes its green for a
# guarantee: it proves the files exist and reference each other. It cannot
# prove anyone read docs/architecture/07-Frontend/09-Adding-A-Game.md, that a
# page renders, or that a setup form binds the right fields. The doc is the
# map; this is the specific failure a map does not catch — a registry left
# half-edited, which fails no test because every game's tests only ever
# exercise that game.
#
# ARGUMENT: takes an optional app-root path (default `app`) purely so the gate
# can be aimed at a fixture tree and proven to FAIL. A gate not proven to bite
# is not a gate. Pre-commit and CI both invoke the zero-argument form.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

APP_ROOT="${1:-app}"

python3 - "$APP_ROOT" <<'PY'
import re
import sys
from pathlib import Path

app = Path(sys.argv[1])
FAIL = 0


def err(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = 1


def ok(msg: str) -> None:
    print(f"OK: {msg}")


REGISTRY = app / "src/services/rulesets/registry.ts"
CAPABILITIES = app / "src/lib/game/rulesets/capabilities.ts"
VISIBILITY = app / "src/lib/game/rulesets/games-visibility.ts"
ROUTE_DATA = app / "src/lib/client/alpine/register-route-data.ts"

missing = [p for p in (REGISTRY, CAPABILITIES, VISIBILITY, ROUTE_DATA) if not p.is_file()]
for p in missing:
    err(f"{p} not found")
if missing:
    sys.exit(1)

registry_text = REGISTRY.read_text(encoding="utf-8")
capabilities_text = CAPABILITIES.read_text(encoding="utf-8")
visibility_text = VISIBILITY.read_text(encoding="utf-8")
route_data_text = ROUTE_DATA.read_text(encoding="utf-8")

# --- Parse the registry: key -> validator module path ----------------------
imports = dict(
    (name, path)
    for name, path in re.findall(
        r'import\s*\{\s*(\w+)\s*\}\s*from\s*"\./([\w./-]+)"\s*;', registry_text
    )
)
body = re.search(r"const REGISTRY[^{]*\{(.*?)\n\};", registry_text, re.S)
if body is None:
    err(f"{REGISTRY}: no `const REGISTRY` object literal block found")
    sys.exit(1)
entries = re.findall(r'^\s*"?([A-Z0-9_]+)"?:\s*(\w+),', body.group(1), re.M)
if not entries:
    err(f"{REGISTRY}: REGISTRY block declares no ruleset keys")
    sys.exit(1)

# --- Parse the capability keys ---------------------------------------------
cap_body = re.search(
    r"export const RULESET_CAPABILITIES[^{]*\{(.*?)\n\};", capabilities_text, re.S
)
cap_keys = (
    set(re.findall(r'^\s*"?([A-Z0-9_]+)"?:', cap_body.group(1), re.M))
    if cap_body
    else set()
)
if not cap_keys:
    err(f"{CAPABILITIES}: no RULESET_CAPABILITIES keys found")
    sys.exit(1)

# --- Parse the game cards: key -> route slug -------------------------------
cards = {}
for block in re.findall(r"\{(.*?)\}", visibility_text.split("GAME_CARDS")[1], re.S):
    key = re.search(r'rulesetVersionKey:\s*"([A-Z0-9_]+)"', block)
    href = re.search(r'href:\s*"/games/([\w-]+)/setup"', block)
    if key and href:
        cards[key.group(1)] = href.group(1)
if not cards:
    err(f"{VISIBILITY}: no GAME_CARDS entries found")
    sys.exit(1)

registered = set(re.findall(r'Alpine\.data\(\s*"(\w+)"', route_data_text))
data_imports = dict(
    (name, slug)
    for name, slug in re.findall(
        r'import\s*\{\s*(\w+)\s*\}\s*from\s*"@lib/game/([\w-]+)-(?:setup|play)\.data"\s*;',
        route_data_text,
    )
)

code_slugs = set()
checked = 0

for key, binding in entries:
    module = imports.get(binding)
    if module is None:
        err(f"{REGISTRY}: {key} maps to `{binding}`, which the file never imports")
        continue

    validator = app / "src/services/rulesets" / f"{module}.ts"
    if not validator.is_file():
        err(f"{REGISTRY}: {key}'s validator `{validator}` does not exist")

    if key not in cap_keys:
        err(f"{key} has a validator but is not declared in {CAPABILITIES}")

    code_slug = module.split("/")[0]
    code_slugs.add(code_slug)
    setup_data = app / f"src/lib/game/{code_slug}-setup.data.ts"
    play_data = app / f"src/lib/game/{code_slug}-play.data.ts"

    if key not in cards:
        for stray in (setup_data, play_data):
            if stray.is_file():
                err(
                    f"{key} is engine-only (absent from {VISIBILITY}) but `{stray}` exists — "
                    "a game is either wired end to end or not wired at all"
                )
        stray_pages = app / f"src/pages/games/{code_slug}"
        if stray_pages.is_dir():
            err(
                f"{key} is engine-only (absent from {VISIBILITY}) but `{stray_pages}` exists"
            )
        checked += 1
        continue

    route_slug = cards[key]
    for data_file in (setup_data, play_data):
        if not data_file.is_file():
            err(f"{key} renders a card but `{data_file}` does not exist")

    for kind in ("setup", "play"):
        page = app / f"src/pages/games/{route_slug}/{kind}/index.astro"
        if not page.is_file():
            err(f"{key}'s card points at /games/{route_slug} but `{page}` does not exist")
            continue
        name = re.search(r'x-data="(\w+)\(\)"', page.read_text(encoding="utf-8"))
        if name is None:
            err(f"{page}: no x-data controller call found")
            continue
        controller = name.group(1)
        if controller not in registered:
            err(
                f"{page} mounts `{controller}()` but {ROUTE_DATA} never calls "
                f'Alpine.data("{controller}", callback) — the page renders and the controller is undefined'
            )
        elif data_imports.get(controller) != code_slug:
            err(
                f'{ROUTE_DATA} registers "{controller}" but does not import it from '
                f"`@lib/game/{code_slug}-{kind}.data`"
            )
    checked += 1

for key in cards:
    if key not in {k for k, _ in entries}:
        err(f"{VISIBILITY} renders a card for {key}, which has no entry in {REGISTRY}")

for name, slug in data_imports.items():
    if slug not in code_slugs:
        err(
            f"{ROUTE_DATA} imports `{name}` from `@lib/game/{slug}-*.data`, but no ruleset "
            f"in {REGISTRY} owns the `{slug}` slug"
        )

if FAIL:
    sys.exit(1)

ok(f"game wiring — {checked} ruleset(s) checked against six shared registries")
sys.exit(0)
PY
