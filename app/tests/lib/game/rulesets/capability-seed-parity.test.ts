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

const verificationPath = fileURLToPath(
  new URL(
    "../../../../../database/verification/0007_capability_seed_checks.sql",
    import.meta.url,
  ),
);

const TRIPLE = /\('([A-Z0-9_]+)',\s*'([A-Z_]+)',\s*'([A-Z_]+)'\)/g;

function triplesIn(sql: string): string[] {
  const triples: string[] = [];
  for (const match of sql.matchAll(TRIPLE)) {
    triples.push(`${match[1]}|${match[2]}|${match[3]}`);
  }
  return triples.sort();
}

function seededTriples(): string[] {
  return triplesIn(readFileSync(seedPath, "utf8"));
}

/**
 * The verification script transcribes `RULESET_CAPABILITIES` twice — Step 2
 * drives the per-triple resolution checks, Step 4 the "nothing else in the
 * table" parity check. They are parsed as separate lists on purpose: a single
 * combined parse lets a stale list hide behind a current one, which is exactly
 * how both fell six triples behind `capabilities.ts` (issue #304).
 */
function verificationTripleLists(): string[][] {
  const sql = readFileSync(verificationPath, "utf8");
  const lists: string[][] = [];
  for (const block of sql.matchAll(/VALUES\s*(\([\s\S]*?)\)\s*AS declared/g)) {
    lists.push(triplesIn(block[1]));
  }
  return lists;
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

describe("capability constant and verification script agree", () => {
  it("finds both of the script's VALUES lists", () => {
    expect(verificationTripleLists()).toHaveLength(2);
  });

  it.each([
    ["step 2 (per-triple resolution)", 0],
    ["step 4 (nothing else in the table)", 1],
  ])("%s lists exactly the declared triples", (_name, index) => {
    expect(verificationTripleLists()[index]).toEqual(declaredTriples());
  });

  it("hardcodes the declared triple count in every assertion", () => {
    const sql = readFileSync(verificationPath, "utf8");
    const n = declaredTriples().length;

    expect(sql).toContain(`'seed inserted exactly the ${n} declared rows'`);
    expect(sql).toContain(`format('expected ${n}, found %s', count(*))`);
    expect(sql).toContain(`'all ${n} declared triples were actually checked'`);
    expect(sql).toContain(`format('%s of ${n} triple checks ran', count(*))`);
    const countChecks = sql.match(/WHEN count\(\*\) = \d+ THEN 'PASS'/g) ?? [];
    expect(
      countChecks.filter(
        (check) => check === `WHEN count(*) = ${n} THEN 'PASS'`,
      ),
    ).toHaveLength(2);
  });
});
