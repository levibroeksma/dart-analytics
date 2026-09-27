/**
 * A stable grouping key for a game-specific section's `configSensitive`
 * fields (`01-Section-Catalog.md` §2.1, phase-4 decision 13): the session's
 * `rulesetVersionKey`, then every field in `fields` other than
 * `ruleset_version_key` as `field=value`, in declared order. A field absent
 * from `session.configuration` (or a null `configuration`) renders as
 * `field=` rather than throwing, so a configuration snapshot missing a later
 * field still groups deterministically.
 */
export function configGroupKey(
  fields: readonly string[],
  session: {
    rulesetVersionKey: string;
    configuration: Record<string, unknown> | null;
  },
): string {
  const parts = [session.rulesetVersionKey];
  for (const field of fields) {
    if (field === "ruleset_version_key") continue;
    const value = session.configuration?.[field] ?? "";
    parts.push(`${field}=${value}`);
  }
  return parts.join("|");
}
