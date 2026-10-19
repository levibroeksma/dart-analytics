import { describe, it, expect } from "vitest";
import { groupCatalog } from "@lib/training/routines/catalog-groups";
import type {
  CatalogTag,
  CatalogTagsResponse,
  CatalogTagSet,
} from "@lib/types";
import type { ExerciseTemplateCatalogEntryData } from "@client/api/types";

const entry = (
  over: Partial<ExerciseTemplateCatalogEntryData>,
): ExerciseTemplateCatalogEntryData => ({
  exerciseTemplateId: "t",
  name: "Template",
  description: "desc",
  exerciseTypeKey: "SWITCHING",
  gameTypeKey: null,
  gameRulesetVersionKey: null,
  exerciseTypeName: "Switching",
  gameTypeName: null,
  difficultyLevel: null,
  ...over,
});

const skill: CatalogTag = {
  axis: "SKILL",
  key: "SCORING",
  name: "Scoring",
  primary: true,
};
const set = (level: 1 | 2 | 3 | 4 | null): CatalogTagSet => ({
  tags: [skill],
  difficultyLevel: level,
});
const tags: CatalogTagsResponse = {
  games: {
    TUOD: { standalone: set(1), routineStep: set(3) },
    AROUND_THE_CLOCK: { standalone: set(1), routineStep: set(2) },
  },
  exercises: { BULL_UP: set(2) },
};

describe("groupCatalog", () => {
  it("collapses templates sharing a game type into one named group", () => {
    const groups = groupCatalog(
      [
        entry({
          exerciseTemplateId: "a",
          name: "ATC Singles",
          exerciseTypeKey: "GAME",
          gameTypeKey: "AROUND_THE_CLOCK",
          gameTypeName: "Around the Clock",
          exerciseTypeName: "Game",
          difficultyLevel: 1,
        }),
        entry({
          exerciseTemplateId: "b",
          name: "ATC Doubles",
          exerciseTypeKey: "GAME",
          gameTypeKey: "AROUND_THE_CLOCK",
          gameTypeName: "Around the Clock",
          exerciseTypeName: "Game",
          difficultyLevel: 3,
        }),
      ],
      tags,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("AROUND_THE_CLOCK");
    expect(groups[0].name).toBe("Around the Clock");
    expect(groups[0].blurb).toBe("desc");
    expect(groups[0].entries.map((e) => e.label)).toEqual([
      "ATC Singles",
      "ATC Doubles",
    ]);
    expect(groups[0].entries.map((e) => e.level)).toEqual([1, 3]);
  });

  it("groups a GAME entry by gameTypeKey and uses routine-step tags", () => {
    const [group] = groupCatalog(
      [
        entry({
          exerciseTypeKey: "GAME",
          gameTypeKey: "TUOD",
          gameTypeName: "Tour of the Doubles",
          exerciseTypeName: "Game",
        }),
      ],
      tags,
    );
    expect(group.key).toBe("TUOD");
    expect(group.tags).toEqual([skill]);
  });

  it("groups exercise types by exerciseTypeKey with exercise tags", () => {
    const [group] = groupCatalog(
      [
        entry({
          exerciseTypeKey: "BULL_UP",
          exerciseTypeName: "Bull Up",
          name: "Bull Up 10",
        }),
      ],
      tags,
    );
    expect(group.key).toBe("BULL_UP");
    expect(group.name).toBe("Bull Up");
    expect(group.tags).toEqual([skill]);
  });

  it("gives an untagged type no tags and a null level", () => {
    const [group] = groupCatalog([entry({})], tags);
    expect(group.tags).toEqual([]);
    expect(group.entries[0].level).toBeNull();
  });

  it("still groups when the tags fetch failed", () => {
    const groups = groupCatalog(
      [entry({}), entry({ exerciseTemplateId: "u", name: "Other" })],
      null,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].tags).toEqual([]);
    expect(groups[0].entries).toHaveLength(2);
  });

  it("keeps first-seen group order", () => {
    const groups = groupCatalog(
      [
        entry({ exerciseTypeKey: "B", exerciseTypeName: "B" }),
        entry({ exerciseTypeKey: "A", exerciseTypeName: "A" }),
        entry({ exerciseTypeKey: "B", exerciseTypeName: "B" }),
      ],
      null,
    );
    expect(groups.map((g) => g.key)).toEqual(["B", "A"]);
  });
});
