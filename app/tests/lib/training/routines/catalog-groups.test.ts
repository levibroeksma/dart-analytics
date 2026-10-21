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
  exerciseTypeDescription: null,
  gameTypeDescription: null,
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
  it("takes the blurb from the game type description first", () => {
    const [group] = groupCatalog(
      [
        entry({
          description: "first template",
          exerciseTypeKey: "GAME",
          gameTypeKey: "TUOD",
          gameTypeName: "Tour of the Doubles",
          exerciseTypeDescription: "Play a game as a step",
          gameTypeDescription: "Hit every double in order",
        }),
      ],
      null,
    );
    expect(group.blurb).toBe("Hit every double in order");
  });

  it("falls back to the exercise type description for an exercise", () => {
    const [group] = groupCatalog(
      [
        entry({
          description: "first template",
          exerciseTypeDescription: "Switch targets every visit",
        }),
      ],
      null,
    );
    expect(group.blurb).toBe("Switch targets every visit");
  });

  it("falls back to the first template description with no type description", () => {
    const [group] = groupCatalog([entry({ description: "first" })], null);
    expect(group.blurb).toBe("first");
  });

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
      "ATC Doubles",
      "ATC Singles",
    ]);
    expect(groups[0].entries.map((e) => e.level)).toEqual([3, 1]);
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

  it("gives a GAME entry without a gameTypeKey no tags", () => {
    const [group] = groupCatalog(
      [entry({ exerciseTypeKey: "GAME", gameTypeKey: null })],
      tags,
    );
    expect(group.tags).toEqual([]);
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

  it("orders groups by their own name, not by first-seen entry", () => {
    const groups = groupCatalog(
      [
        entry({ exerciseTypeKey: "B", exerciseTypeName: "B" }),
        entry({ exerciseTypeKey: "A", exerciseTypeName: "A" }),
        entry({ exerciseTypeKey: "B", exerciseTypeName: "B" }),
      ],
      null,
    );
    expect(groups.map((g) => g.key)).toEqual(["A", "B"]);
  });

  it("keeps a card under its own initial when a row sorts earlier", () => {
    const groups = groupCatalog(
      [
        entry({
          exerciseTemplateId: "chain",
          name: "Chain",
          exerciseTypeKey: "SWITCHING",
          exerciseTypeName: "Switching",
        }),
        entry({
          exerciseTemplateId: "dl",
          name: "Doubles Lock",
          exerciseTypeKey: "DOUBLES_LOCK",
          exerciseTypeName: "Doubles Lock",
        }),
        entry({
          exerciseTemplateId: "standard",
          name: "Standard",
          exerciseTypeKey: "SWITCHING",
          exerciseTypeName: "Switching",
        }),
      ],
      null,
    );
    expect(groups.map((g) => g.name)).toEqual(["Doubles Lock", "Switching"]);
    expect(groups[1].entries.map((e) => e.label)).toEqual([
      "Chain",
      "Standard",
    ]);
  });

  it("orders rows within a card by template name", () => {
    const [group] = groupCatalog(
      [
        entry({ exerciseTemplateId: "c", name: "Zulu" }),
        entry({ exerciseTemplateId: "a", name: "Alpha" }),
        entry({ exerciseTemplateId: "b", name: "Mike" }),
      ],
      null,
    );
    expect(group.entries.map((e) => e.label)).toEqual([
      "Alpha",
      "Mike",
      "Zulu",
    ]);
  });
});
