import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@repositories/catalog.repository", () => ({
  findCatalogTagRows: vi.fn(),
}));

import * as repo from "@repositories/catalog.repository";
import { getCatalogTags } from "@services/catalog.service";
import type { CatalogTagRow } from "@repositories/interfaces";

const row = (
  entityKind: string,
  typeKey: string,
  contextKey: string,
  axisKey: string,
  tagKey: string,
  isPrimary = false,
  axisRank = 1,
): CatalogTagRow => ({
  entityKind,
  typeKey,
  contextKey,
  axisKey,
  tagKey,
  tagName: tagKey.toLowerCase(),
  isPrimary,
  sortOrder: axisRank,
  axisRank,
});

beforeEach(() => {
  vi.mocked(repo.findCatalogTagRows).mockReset();
});

describe("getCatalogTags", () => {
  it("groups rows per game type and context and per exercise type", async () => {
    vi.mocked(repo.findCatalogTagRows).mockResolvedValue([
      row("GAME", "CRICKET", "STANDALONE", "SKILL", "SCORING", true),
      row("GAME", "CRICKET", "STANDALONE", "DIFFICULTY", "ADVANCED", false, 3),
      row("GAME", "CRICKET", "ROUTINE_STEP", "SKILL", "ACCURACY", true),
      row("EXERCISE", "DOUBLES_LOCK", "ROUTINE_STEP", "SKILL", "DOUBLES", true),
      row(
        "EXERCISE",
        "DOUBLES_LOCK",
        "ROUTINE_STEP",
        "DIFFICULTY",
        "INTERMEDIATE",
        false,
        2,
      ),
    ]);
    const result = await getCatalogTags();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cricket = result.data.games.CRICKET!;
    expect(cricket.standalone.tags).toEqual([
      { axis: "SKILL", key: "SCORING", name: "scoring", primary: true },
      { axis: "DIFFICULTY", key: "ADVANCED", name: "advanced", primary: false },
    ]);
    expect(cricket.standalone.difficultyLevel).toBe(3);
    expect(cricket.routineStep.tags.map((t) => t.key)).toEqual(["ACCURACY"]);
    expect(cricket.routineStep.difficultyLevel).toBeNull();
    expect(result.data.exercises.DOUBLES_LOCK!.difficultyLevel).toBe(2);
    expect(result.data.exercises.DOUBLES_LOCK!.tags).toHaveLength(2);
  });

  it("defaults a missing game context to an empty set", async () => {
    vi.mocked(repo.findCatalogTagRows).mockResolvedValue([
      row("GAME", "TUOD", "STANDALONE", "SKILL", "CHECKOUT", true),
    ]);
    const result = await getCatalogTags();
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.games.TUOD!.routineStep).toEqual({
      tags: [],
      difficultyLevel: null,
    });
  });

  it("leaves difficultyLevel null with zero or several DIFFICULTY tags", async () => {
    vi.mocked(repo.findCatalogTagRows).mockResolvedValue([
      row("EXERCISE", "A", "ROUTINE_STEP", "SKILL", "DOUBLES", true),
      row("EXERCISE", "B", "ROUTINE_STEP", "DIFFICULTY", "BEGINNER"),
      row("EXERCISE", "B", "ROUTINE_STEP", "DIFFICULTY", "EXPERT"),
    ]);
    const result = await getCatalogTags();
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.exercises.A!.difficultyLevel).toBeNull();
    expect(result.data.exercises.B!.difficultyLevel).toBeNull();
  });

  it("takes difficultyLevel from axis_rank, not from the tag key", async () => {
    vi.mocked(repo.findCatalogTagRows).mockResolvedValue([
      row("EXERCISE", "A", "ROUTINE_STEP", "DIFFICULTY", "NEW_TIER", false, 3),
    ]);
    const result = await getCatalogTags();
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.exercises.A!.difficultyLevel).toBe(3);
  });

  it("throws when a DIFFICULTY axis_rank is outside 1-4", async () => {
    vi.mocked(repo.findCatalogTagRows).mockResolvedValue([
      row("EXERCISE", "A", "ROUTINE_STEP", "DIFFICULTY", "BEGINNER", false, 5),
    ]);
    await expect(getCatalogTags()).rejects.toThrow(/axis_rank/);
  });

  it("rejects an unknown axis rather than guessing", async () => {
    vi.mocked(repo.findCatalogTagRows).mockResolvedValue([
      row("EXERCISE", "A", "ROUTINE_STEP", "BOGUS", "X"),
    ]);
    await expect(getCatalogTags()).rejects.toThrow(/axis_key/);
  });

  it("rejects an unknown entity kind", async () => {
    vi.mocked(repo.findCatalogTagRows).mockResolvedValue([
      row("TRIVIA", "A", "ROUTINE_STEP", "SKILL", "SCORING", true),
    ]);
    await expect(getCatalogTags()).rejects.toThrow(
      "v_catalog_tags: unknown entity_kind TRIVIA",
    );
  });

  it("keeps view row order within each set when rows interleave", async () => {
    vi.mocked(repo.findCatalogTagRows).mockResolvedValue([
      row("GAME", "CRICKET", "STANDALONE", "SKILL", "SCORING", true),
      row("GAME", "CRICKET", "ROUTINE_STEP", "SKILL", "ACCURACY", true),
      row("EXERCISE", "BULL_UP", "ROUTINE_STEP", "SKILL", "BULL", true),
      row("GAME", "CRICKET", "STANDALONE", "SKILL", "TACTICS"),
      row("EXERCISE", "BULL_UP", "ROUTINE_STEP", "SKILL", "ACCURACY"),
      row("GAME", "CRICKET", "ROUTINE_STEP", "SKILL", "SCORING"),
    ]);
    const result = await getCatalogTags();
    if (!result.ok) throw new Error("expected ok");
    const keys = (set: { tags: { key: string }[] }) =>
      set.tags.map((t) => t.key);
    expect(keys(result.data.games.CRICKET.standalone)).toEqual([
      "SCORING",
      "TACTICS",
    ]);
    expect(keys(result.data.games.CRICKET.routineStep)).toEqual([
      "ACCURACY",
      "SCORING",
    ]);
    expect(keys(result.data.exercises.BULL_UP)).toEqual(["BULL", "ACCURACY"]);
  });
});
