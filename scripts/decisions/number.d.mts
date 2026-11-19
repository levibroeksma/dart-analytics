export function loadExclusions(file?: string): string[];
export function numberPending(args: {
  root: string;
  mainMaxId: number;
  changedFiles: string[];
  mainFiles?: string[];
  exclusions?: string[];
}): { renames: [string, string][]; rewrites: string[] };
