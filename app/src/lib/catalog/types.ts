export type AxisKey =
  | "SKILL"
  | "SESSION_ROLE"
  | "FORMAT"
  | "DIFFICULTY"
  | "MECHANIC"
  | "PRESSURE"
  | "FAMILY";

export type CatalogTag = {
  axis: AxisKey;
  key: string;
  name: string;
  primary: boolean;
};

export type DifficultyLevel = 1 | 2 | 3 | 4;

export type CatalogTagSet = {
  tags: CatalogTag[];
  difficultyLevel: DifficultyLevel | null;
};

export type CatalogTagsResponse = {
  games: Record<
    string,
    { standalone: CatalogTagSet; routineStep: CatalogTagSet }
  >;
  exercises: Record<string, CatalogTagSet>;
};

export type CatalogCardKind = "game" | "exercise";
