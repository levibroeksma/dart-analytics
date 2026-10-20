import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * This file's own path, relative to the repository root. The search pattern
 * below must name the erased type to find it, so this file's source text
 * matches its own pattern; without this exclusion the gate would always fail
 * against itself regardless of the rest of the repository.
 */
const selfPath = fileURLToPath(import.meta.url)
  .slice(repoRoot.length)
  .replaceAll("\\", "/");

const ERASED_TYPE_PATTERN = /switching.target.scoring|switchingtargetscoring/i;

/**
 * Directories that are entirely append-only history: every file under them
 * may name the erased type freely, because the whole directory exists to
 * record what happened, not what currently exists.
 */
const ALLOWED_PREFIXES = [
  "decisions/",
  "docs/superpowers/",
  "graphify-out/",
  "database/migrations/",
];

/**
 * Individual files outside those directories that are still part of the
 * historical record, matched exactly rather than by prefix so a sibling
 * file (`docs/architecture/00-File-Inventory-Draft.md`, say) cannot slip
 * through unexamined. Each one names the erased type precisely because it
 * documents or verifies the erasure itself:
 *
 * - `switching-target-scoring-erased.itest.ts` is the integration test that
 *   proves the type is gone from the live database; naming it is the test.
 * - `seed.test.ts` explains why seed numbering has a permanent gap at `0024`
 *   — the seed that created the type's rows, retired rather than renumbered.
 * - `05-Database/03-Migrations.md` is the per-migration changelog; its
 *   `0048` chapter documents the erasure migration by name, mirroring
 *   `database/migrations/0048_erase_switching_target_scoring.sql` itself.
 * - `00-File-Inventory.md`'s row for that changelog file summarizes the same
 *   chapter.
 *
 * This is the same reasoning that already allowlists `database/migrations/`
 * wholesale: a migration must name what it erases, and so must everything
 * written to document or verify that it did.
 */
const ALLOWED_EXACT_FILES = new Set([
  "docs/architecture/00-Context-Map-History.md",
  "app/tests/integration/switching-target-scoring-erased.itest.ts",
  "app/tests/scripts/seed.test.ts",
  "docs/architecture/05-Database/03-Migrations.md",
  "docs/architecture/00-File-Inventory.md",
]);

/**
 * Lists every path git knows about — tracked and untracked-but-not-ignored —
 * relative to the repository root, independent of vitest's own working
 * directory (`app/`). `git ls-files` naturally excludes `node_modules/`,
 * build output and anything else `.gitignore` already keeps out, so scratch
 * directories like `.superpowers/sdd/` never reach the search.
 */
function repositoryFiles(): string[] {
  const tracked = execFileSync("git", ["-C", repoRoot, "ls-files"], {
    encoding: "utf8",
  });
  const untracked = execFileSync(
    "git",
    ["-C", repoRoot, "ls-files", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );
  const files = new Set(
    [...tracked.split("\n"), ...untracked.split("\n")].filter(Boolean),
  );
  return [...files];
}

function mentionsErasedType(relativePath: string): boolean {
  let contents: string;
  try {
    contents = readFileSync(resolve(repoRoot, relativePath), "utf8");
  } catch {
    return false;
  }
  return ERASED_TYPE_PATTERN.test(contents);
}

function isHistoricalRecord(relativePath: string): boolean {
  if (relativePath === selfPath) return true;
  if (ALLOWED_EXACT_FILES.has(relativePath)) return true;
  return ALLOWED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function findLiveMentions(): string[] {
  return repositoryFiles()
    .filter((relativePath) => !isHistoricalRecord(relativePath))
    .filter(mentionsErasedType);
}

describe("erasure gate", () => {
  it("mentions the erased type only in the historical record", () => {
    const live = findLiveMentions();
    expect(
      live,
      `the erased exercise type reappeared outside the historical record in: ${live.join(", ")}`,
    ).toEqual([]);
  });
});
