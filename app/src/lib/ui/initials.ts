/**
 * Avatar initials: first letter of the first and last word, uppercased;
 * one letter for a single word; `?` when empty.
 */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

/** Mono caps seat count for the Players card header. */
export function playerCountLabel(count: number): string {
  return `${count} PLAYER${count === 1 ? "" : "S"}`;
}
