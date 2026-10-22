/** The trimmed, non-empty value of `?<name>=` on the current page, or null (also null outside a browser). */
export function searchParamFromLocation(name: string): string | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get(name);
  return value && value.trim().length > 0 ? value : null;
}
