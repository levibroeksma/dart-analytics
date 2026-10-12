import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "hero",
        "title",
        "value",
        "tile",
        "card-title",
        "control",
        "eyebrow",
        "eyebrow-lg",
        "body-sm",
        "caption",
        "micro",
        "key",
        "key-label",
        "stat",
        "summary",
        "summary-lg",
        "numeral-1",
        "numeral-2",
        "numeral-3",
        "numeral-4",
        "numeral-5",
        "numeral-6",
      ],
    },
    classGroups: {
      "border-w": ["border-medium"],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
