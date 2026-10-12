import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { MERGE_TOKENS, UTILITY_GROUPS } from "@client/merge-tokens";

const utilityGroups: Record<string, string[]> = {};
for (const [utility, group] of Object.entries(UTILITY_GROUPS)) {
  if (group) (utilityGroups[group] ??= []).push(utility);
}

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...MERGE_TOKENS.text],
      radius: [...MERGE_TOKENS.radius],
      shadow: [...MERGE_TOKENS.shadow],
      "text-shadow": [...MERGE_TOKENS["text-shadow"]],
      spacing: [...MERGE_TOKENS.spacing],
      animate: [...MERGE_TOKENS.animate],
    },
    classGroups: {
      ...utilityGroups,
      "grid-cols": [
        { "grid-cols": [...MERGE_TOKENS["grid-template-columns"]] },
      ],
      "bg-image": [{ bg: [...MERGE_TOKENS["background-image"]] }],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
