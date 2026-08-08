import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RULESET_CAPABILITIES } from "@lib/game/rulesets/capabilities";

const seedPath = fileURLToPath(
  new URL(
    "../../../../../database/seeds/0007_ruleset_version_capabilities.sql",
    import.meta.url,
  ),
);

function seededTriples(): string[] {
  const sql = readFileSync(seedPath, "utf8");
  const triples: string[] = [];
  for (const match of sql.matchAll(
    /\('([A-Z0-9_]+)',\s*'([A-Z_]+)',\s*'([A-Z_]+)'\)/g,
  )) {
    triples.push(`${match[1]}|${match[2]}|${match[3]}`);
  }
  return triples.sort();
}

function declaredTriples(): string[] {
  const triples: string[] = [];
  for (const [rulesetKey, pairs] of Object.entries(RULESET_CAPABILITIES)) {
    for (const pair of pairs) {
      triples.push(`${rulesetKey}|${pair.captureModeKey}|${pair.inputModeKey}`);
    }
  }
  return triples.sort();
}

describe("capability constant and seed agree", () => {
  it("finds triples in the seed at all", () => {
    expect(seededTriples().length).toBeGreaterThan(0);
  });

  it("declares exactly the same triples on both sides", () => {
    expect(seededTriples()).toEqual(declaredTriples());
  });
});
