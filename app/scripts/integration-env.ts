/**
 * `DATABASE_URL` for the integration suite: the shell's value wins, else the
 * one in `.env`. Nothing else from the env file reaches the tests.
 *
 * @param fileEnv - Variables parsed from `.env`.
 * @param processEnv - The shell's environment.
 * @returns `{ DATABASE_URL }` to add to the test env, or `{}`.
 */
export function databaseUrlEnv(
  fileEnv: Record<string, string>,
  processEnv: Record<string, string | undefined>,
): Record<string, string> {
  const url = fileEnv.DATABASE_URL;
  if (processEnv.DATABASE_URL || !url) return {};
  return { DATABASE_URL: url };
}
