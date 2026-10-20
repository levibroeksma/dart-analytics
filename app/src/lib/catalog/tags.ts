import type {
  AxisKey,
  CatalogCardKind,
  CatalogTag,
  CatalogTagSet,
} from "./types";

export const AXIS_KEYS: readonly AxisKey[] = [
  "SKILL",
  "SESSION_ROLE",
  "FORMAT",
  "DIFFICULTY",
  "MECHANIC",
  "PRESSURE",
  "FAMILY",
];

const PRESSURE_NONE_KEY = "NONE";

const byAxis = (tags: CatalogTag[], axis: AxisKey): CatalogTag[] =>
  tags.filter((tag) => tag.axis === axis);

const shownPressure = (tags: CatalogTag[]): CatalogTag[] =>
  byAxis(tags, "PRESSURE").filter((tag) => tag.key !== PRESSURE_NONE_KEY);

/**
 * The pills a catalog card shows, in display order. Input order within an
 * axis is the view's `sort_order` and is preserved.
 */
export function cardTags(
  set: CatalogTagSet,
  kind: CatalogCardKind,
): CatalogTag[] {
  const skills = byAxis(set.tags, "SKILL");
  const primarySkills = skills.filter((tag) => tag.primary);
  if (kind === "game") {
    return [
      ...primarySkills,
      ...byAxis(set.tags, "FORMAT"),
      ...shownPressure(set.tags),
      ...byAxis(set.tags, "FAMILY"),
    ];
  }
  return [
    ...primarySkills,
    ...skills.filter((tag) => !tag.primary),
    ...shownPressure(set.tags),
    ...byAxis(set.tags, "SESSION_ROLE"),
  ];
}
