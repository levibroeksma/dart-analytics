const SHORT: Record<string, string> = {
  TREBLE: "T",
  DOUBLE: "D",
  SINGLE: "S",
};

/** A board target key as a short label: `TREBLE:20` is `T20`, `WIRE:20-1` is `20/1 wire`. */
export function aimLabel(key: string): string {
  const [kind, value = ""] = key.split(":");
  if (kind === "INNER_BULL") return "Bull";
  if (kind === "OUTER_BULL") return "25";
  if (kind === "WIRE") return `${value.replace("-", "/")} wire`;
  return `${SHORT[kind] ?? kind}${value}`;
}
