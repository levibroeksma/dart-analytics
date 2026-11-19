import type { DecisionRecord } from "./lib.mjs";

export interface SplitRecord extends DecisionRecord {
  refs: string[];
}

export function splitDomainFile(
  text: string,
  domain: string,
  opts?: { file?: string; warn?: (w: string) => void },
): SplitRecord[];
export function linkSupersedes(records: SplitRecord[]): void;
