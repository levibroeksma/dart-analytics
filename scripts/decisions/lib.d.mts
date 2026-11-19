export type Frontmatter = Record<string, string | string[]>;

export interface DecisionRecord {
  fm: Frontmatter;
  title: string;
  sections: Map<string, string>;
  thin?: boolean;
  extra?: string;
  dupes?: string[];
}

export const UNKNOWN: string;
export const THIN_MARKER: string;
export const FM_KEYS: string[];
export const DOMAINS: unknown[];
export const HEADINGS: string[];
export function slugify(title: string): string;
export function parseRecord(text: string): DecisionRecord;
export function renderRecord(r: {
  fm: Frontmatter;
  title: string;
  sections: Map<string, string>;
  thin?: boolean;
}): string;
export function validateRecord(
  r: DecisionRecord,
  path: string,
  opts: { maxBaselineId: number },
): string[];
export function listRecords(
  root?: string,
): { path: string; record: DecisionRecord }[];
