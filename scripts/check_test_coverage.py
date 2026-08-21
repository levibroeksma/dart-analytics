"""Change-set analysis for scripts/check-test-coverage.sh (D224).

Invoked only by that script, which owns the rule's documentation and derives
the change set. This file answers, per changed source file: did its runtime
behaviour move, which tests import it, and did any of those tests move too.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

TESTS_ROOT = Path("app/tests")
SOURCE_ROOTS = ("app/src/", "app/scripts/")

# Generated output: the command that owns the file, not a person. Editing it by
# hand is already forbidden (app/CLAUDE.md, "Never use Drizzle to generate or
# own migrations"), so demanding a test edit for a re-introspection would
# punish the correct workflow.
GENERATED = {
    "app/src/db/schema.ts": "drizzle-kit introspect",
    "app/src/db/relations.ts": "drizzle-kit introspect",
}

OWN_RUNTIME_DECL = re.compile(
    r"^export\s+(?:default\b|abstract\s+class\b|async\s+function\b|function\b"
    r"|class\b|const\b|let\b|var\b|enum\b)",
    re.MULTILINE,
)

TYPE_DECL_START = re.compile(
    r"^(?:export\s+)?(?:declare\s+)?(?P<kind>type|interface)\s"
    r"|^(?P<imported>import|export)\s+type\s",
    re.MULTILINE,
)

LINE_COMMENT = re.compile(r"//[^\n]*")
BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)


def load_aliases() -> dict[str, str]:
    """Path aliases read from app/tsconfig.json, never copied here.

    A new alias is covered the moment it is declared. check-alias-sync.sh
    already proves tsconfig.json and vitest.config.ts agree, so either is
    authoritative and this reads the one the compiler uses.
    """
    text = re.sub(r"//.*", "", Path("app/tsconfig.json").read_text(encoding="utf-8"))
    paths = json.loads(text)["compilerOptions"]["paths"]
    aliases: dict[str, str] = {}
    for alias, targets in paths.items():
        if not alias.endswith("/*") or not targets[0].endswith("/*"):
            continue
        aliases[alias[:-2]] = "app/" + targets[0][2:-2].rstrip("/")
    return aliases


ALIASES = load_aliases()


def resolve(specifier: str, importer: Path) -> Path | None:
    """The file a specifier points at, using the compiler's own alias table."""
    if specifier.startswith("."):
        base = (importer.parent / specifier).as_posix()
    else:
        base = None
        for alias, root in sorted(ALIASES.items(), key=lambda kv: -len(kv[0])):
            if specifier == alias or specifier.startswith(alias + "/"):
                base = root + specifier[len(alias) :]
                break
        if base is None:
            return None
    for candidate in (Path(base + ".ts"), Path(base) / "index.ts"):
        if candidate.is_file():
            return candidate
    return None


def declares_runtime(text: str) -> bool:
    """True when the module declares a runtime value of its own.

    A barrel that only re-exports (`export * from`, `export type { ... } from`)
    declares nothing: whatever it forwards is tested where it is written, and
    this repo's type-barrel convention (check-type-barrels.sh) routes every
    shared type through exactly such a file.
    """
    return OWN_RUNTIME_DECL.search(strip_comments(text)) is not None


def strip_comments(text: str) -> str:
    return LINE_COMMENT.sub("", BLOCK_COMMENT.sub("", text))


def runtime_shape(text: str) -> str:
    """The module with every type-level declaration removed.

    Two versions of a file sharing a runtime shape differ only in types, which
    execute nothing and so cannot be asserted on. Each type declaration is
    consumed from its keyword to its own terminator — the matching brace for an
    `interface`, the depth-zero semicolon for a `type` or type-only import —
    rather than by splitting the file into statements first. A conditional type
    (`type A<T> = T extends X ? { ... } : T & { ... };`) returns to depth zero
    twice before it ends, so statement splitting would cut it in half and leave
    the tail behind as if it were runtime code.
    """
    src = strip_comments(text)
    spans: list[tuple[int, int]] = []
    for match in TYPE_DECL_START.finditer(src):
        spans.append((match.start(), end_of_type_decl(src, match)))
    kept: list[str] = []
    cursor = 0
    for begin, finish in spans:
        kept.append(src[cursor:begin])
        cursor = finish
    kept.append(src[cursor:])
    return re.sub(r"\s+", " ", "".join(kept)).strip()


def end_of_type_decl(src: str, match: re.Match[str]) -> int:
    """Index just past the declaration `match` opens."""
    braced = match.group("kind") == "interface"
    depth = 0
    seen_brace = False
    quote: str | None = None
    index = match.start()
    while index < len(src):
        char = src[index]
        if quote is not None:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = None
        elif char in "\"'`":
            quote = char
        elif char in "([{":
            depth += 1
            if char == "{":
                seen_brace = True
        elif char in ")]}":
            depth -= 1
            if braced and seen_brace and depth == 0:
                return index + 1
        elif char == ";" and depth == 0 and not braced:
            return index + 1
        index += 1
    return len(src)


def previous_version(path: str, ref: str) -> str | None:
    """The file as of `ref`, or None when there is nothing to compare against.

    An empty `ref` is the fixture mode's "assume it changed": the caller named
    the file explicitly, so the runtime-shape comparison is skipped and the
    rule is exercised as if the file had just been edited.
    """
    if not ref:
        return None
    result = subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout if result.returncode == 0 else None


def mirrored_test(source: str) -> Path:
    for root in SOURCE_ROOTS:
        if source.startswith(root):
            rest = source[len(root) :]
            prefix = "" if root == "app/src/" else "scripts/"
            return TESTS_ROOT / (prefix + rest[: -len(".ts")] + ".test.ts")
    raise AssertionError(source)


TEST_FILES = sorted(str(p) for p in TESTS_ROOT.rglob("*.test.ts"))

SPECIFIER = re.compile(r"""["'](\.{1,2}/[^"']+|@[a-z]+/[^"']+)["']""")


def build_index() -> dict[str, list[str]]:
    """source path -> tests importing it, resolved specifier by specifier.

    Every quoted relative or aliased specifier in a test is resolved against
    the same alias table the compiler uses, so a match means the test really
    reaches that module — no filename guessing. `vi.mock("@services/x")` is
    caught by the same pass, which matters because a mocked collaborator is
    still a dependency the test pins.
    """
    index: dict[str, list[str]] = {}
    for test in TEST_FILES:
        text = Path(test).read_text(encoding="utf-8")
        for raw in set(SPECIFIER.findall(text)):
            specifier = raw[: -len(".js")] if raw.endswith(".js") else raw
            target = resolve(specifier, Path(test))
            if target is not None:
                index.setdefault(target.as_posix(), []).append(test)
    return index


IMPORTERS = build_index()


def covering_tests(source: str) -> list[str]:
    """Tests importing `source`, the mirrored path reported first."""
    found = sorted(set(IMPORTERS.get(source, [])))
    mirror = str(mirrored_test(source))
    if mirror in found:
        found.remove(mirror)
        found.insert(0, mirror)
    elif Path(mirror).is_file():
        found.insert(0, mirror)
    return found


def in_scope(source: str, base_ref: str) -> bool:
    """Whether this changed file owes the change set a test edit."""
    if not source.startswith(SOURCE_ROOTS):
        return False
    if not source.endswith(".ts") or source.endswith(".d.ts"):
        return False
    if source in GENERATED:
        return False
    path = Path(source)
    if not path.is_file():
        return False
    text = path.read_text(encoding="utf-8")
    if not declares_runtime(text):
        return False
    before = previous_version(source, base_ref)
    if before is None:
        return True
    return runtime_shape(before) != runtime_shape(text)


def main(argv: list[str]) -> int:
    changed = [line.strip() for line in argv[1].splitlines() if line.strip()]
    base_ref = argv[2]
    changed_tests = {c for c in changed if c.startswith("app/tests/")}
    failed = False
    checked: list[tuple[str, str]] = []

    for source in changed:
        if not in_scope(source, base_ref):
            continue

        tests = covering_tests(source)
        if not tests:
            print(
                f"FAIL: {source} changed but no test under app/tests/ imports it — "
                f"write {mirrored_test(source)} before claiming the task done",
                file=sys.stderr,
            )
            failed = True
            continue

        touched = [test for test in tests if test in changed_tests]
        if not touched:
            listed = ", ".join(tests[:3]) + (" ..." if len(tests) > 3 else "")
            print(
                f"FAIL: {source} changed but none of its covering tests changed with "
                f"it ({listed}) — open the covering test and make it describe the new "
                f"behaviour; a source edit with no test edit is not a completed task",
                file=sys.stderr,
            )
            failed = True
            continue

        checked.append((source, touched[0]))

    if failed:
        return 1

    if not checked:
        print("OK: test-coverage — no runtime source change in this change set.")
        return 0

    print(
        f"OK: test-coverage — {len(checked)} changed source file(s) each have a "
        f"covering test changed alongside them."
    )
    for source, test in checked:
        print(f"     {source} -> {test}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
