#!/usr/bin/env bash
# Refinement-coverage gate (Task 10 review incident): a shared-schema
# migration silently dropped a superRefine bounding duration_value; the two
# tests covering it were repointed at a different invalid input and stayed
# green, so nothing but a by-hand diff caught the dropped constraint. This
# ties every superRefine/refine in app/src/lib/game/rulesets/types.ts to
# concrete boundary-test evidence in app/tests/lib/game/rulesets/, so a
# dropped or silently re-bounded constraint fails the build instead.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 - "$@" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

TYPES_FILE = Path("app/src/lib/game/rulesets/types.ts")
TESTS_DIR = Path("app/tests/lib/game/rulesets")

# Schemas this repo currently expects to carry a superRefine/refine boundary
# check. Editing this set is the deliberate, reviewable acknowledgment this
# guard exists to force: adding or removing a schema's refinement without
# touching this line is exactly the silent-drop failure mode from the Task 10
# review (a superRefine deleted, tests quietly repointed elsewhere, still
# green). Update it in the same commit that adds or removes a refinement.
EXPECTED_REFINED_SCHEMAS = {"ScoreTrainingConfig"}


def match_balanced(text: str, open_idx: int, open_ch: str, close_ch: str) -> int | None:
    """Return the index of the char matching text[open_idx], skipping over
    string/template literals so quoted brackets never desync the count."""
    depth = 0
    i = open_idx
    in_str: str | None = None
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
        elif ch in ("\"", "'", "`"):
            in_str = ch
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def schema_chunks(text: str) -> dict[str, str]:
    """Split types.ts into one chunk per `export const NAME = z...` schema
    declaration, each running up to the next such declaration (or EOF)."""
    starts = [
        (m.start(), m.group(1))
        for m in re.finditer(r"^export const (\w+)\s*=\s*z\b", text, re.M)
    ]
    chunks: dict[str, str] = {}
    for i, (start, name) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(text)
        chunks[name] = text[start:end]
    return chunks


def refinement_calls(chunk: str) -> list[str]:
    """Every `.superRefine(...)` / `.refine(...)` call body in one schema
    chunk, extracted with bracket-aware matching (not a single regex) so a
    callback spanning nested braces/parens is captured whole."""
    calls: list[str] = []
    for marker in (".superRefine(", ".refine("):
        idx = 0
        while True:
            pos = chunk.find(marker, idx)
            if pos == -1:
                break
            open_idx = pos + len(marker) - 1
            close_idx = match_balanced(chunk, open_idx, "(", ")")
            if close_idx is None:
                break
            calls.append(chunk[open_idx + 1 : close_idx])
            idx = close_idx + 1
    return calls


def describe_blocks(text: str) -> list[tuple[str, str]]:
    """Every top-level `describe("title", () => { ... })` block: (title,
    body). Used to scope which tests count as a given refinement's coverage."""
    blocks: list[tuple[str, str]] = []
    for m in re.finditer(r"describe\(\s*[\"'`]([^\"'`]*)[\"'`]\s*,", text):
        title = m.group(1)
        brace_start = text.find("{", m.end())
        if brace_start == -1:
            continue
        brace_end = match_balanced(text, brace_start, "{", "}")
        if brace_end is None:
            continue
        blocks.append((title, text[brace_start : brace_end + 1]))
    return blocks


def has_token(corpus: str, n: int) -> bool:
    return re.search(rf"(?<!\d){n}(?!\d)", corpus) is not None


def main() -> int:
    if not TYPES_FILE.is_file():
        print(f"FAIL: {TYPES_FILE} not found", file=sys.stderr)
        return 1
    if not TESTS_DIR.is_dir():
        print(f"FAIL: {TESTS_DIR} not found", file=sys.stderr)
        return 1

    types_text = TYPES_FILE.read_text(encoding="utf-8")
    chunks = schema_chunks(types_text)

    refined: dict[str, dict[str, set]] = {}
    for name, chunk in chunks.items():
        calls = refinement_calls(chunk)
        if not calls:
            continue
        fields: set[str] = set()
        literals: set[int] = set()
        for call in calls:
            fields.update(re.findall(r'path:\s*\[\s*"(\w+)"', call))
            literals.update(int(x) for x in re.findall(r"\b\d+\b", call))
        refined[name] = {"fields": fields, "literals": literals}

    fail = False

    missing = EXPECTED_REFINED_SCHEMAS - refined.keys()
    for name in sorted(missing):
        print(
            f"FAIL: {name} is listed in EXPECTED_REFINED_SCHEMAS "
            f"(scripts/check-refinement-coverage.sh) but no longer has a "
            f"superRefine/refine in {TYPES_FILE} — if the removal is "
            f"intentional, update the manifest in this script",
            file=sys.stderr,
        )
        fail = True

    extra = refined.keys() - EXPECTED_REFINED_SCHEMAS
    for name in sorted(extra):
        print(
            f"FAIL: {name} has a superRefine/refine in {TYPES_FILE} not "
            f"listed in EXPECTED_REFINED_SCHEMAS (scripts/check-refinement-"
            f"coverage.sh) — register it there and give it boundary-test "
            f"coverage in {TESTS_DIR}",
            file=sys.stderr,
        )
        fail = True

    test_files = sorted(TESTS_DIR.rglob("*.test.ts"))
    if not test_files:
        print(f"FAIL: no *.test.ts files found under {TESTS_DIR}", file=sys.stderr)
        return 1
    file_texts = [(p, p.read_text(encoding="utf-8")) for p in test_files]
    all_blocks: list[tuple[str, str]] = []
    for _, text in file_texts:
        all_blocks.extend(describe_blocks(text))
    all_test_text = "\n".join(text for _, text in file_texts)

    for name in sorted(refined):
        info = refined[name]
        fields = sorted(info["fields"]) or [None]
        literals = sorted(info["literals"])

        if name not in all_test_text:
            print(
                f"FAIL: {name} has a superRefine/refine but is not "
                f"referenced anywhere under {TESTS_DIR}",
                file=sys.stderr,
            )
            fail = True
            continue

        for field in fields:
            anchor = field or name
            matched = [body for title, body in all_blocks if anchor in title]
            if not matched and field is not None:
                matched = [body for title, body in all_blocks if name in title]
            if not matched:
                print(
                    f"FAIL: {name}: no describe(...) block under {TESTS_DIR} "
                    f"titled with field '{anchor}' (or schema '{name}') — "
                    f"its refinement has no dedicated boundary-test block",
                    file=sys.stderr,
                )
                fail = True
                continue

            corpus = "\n".join(matched)

            if not re.search(r"toBe\(\s*true\s*\)", corpus):
                print(
                    f"FAIL: {name}/{anchor}: its test block asserts no "
                    f"passing case (no `toBe(true)`)",
                    file=sys.stderr,
                )
                fail = True
            if not re.search(r"toBe\(\s*false\s*\)", corpus):
                print(
                    f"FAIL: {name}/{anchor}: its test block asserts no "
                    f"failing case (no `toBe(false)`)",
                    file=sys.stderr,
                )
                fail = True

            for n in literals:
                if not has_token(corpus, n):
                    print(
                        f"FAIL: {name}/{anchor}: boundary value {n} from its "
                        f"refinement is not referenced in its test block",
                        file=sys.stderr,
                    )
                    fail = True
                    continue
                neighbors = [v for v in (n - 1, n + 1) if v >= 0]
                if not any(has_token(corpus, v) for v in neighbors):
                    print(
                        f"FAIL: {name}/{anchor}: boundary value {n} appears "
                        f"in its test block but neither adjacent value "
                        f"({' or '.join(str(v) for v in neighbors)}) does — "
                        f"no evidence the boundary itself was probed on both "
                        f"sides",
                        file=sys.stderr,
                    )
                    fail = True

    if fail:
        return 1
    print(
        f"OK: {len(refined)} refinement(s) in {TYPES_FILE} have matching "
        f"boundary-test coverage in {TESTS_DIR}: {', '.join(sorted(refined))}."
    )
    return 0


sys.exit(main())
PY
