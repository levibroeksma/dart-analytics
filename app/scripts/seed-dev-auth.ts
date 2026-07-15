/**
 * Dev-only Neon Auth seed — creates levi@broeksma.nl / admin (name: Levi).
 * Run: npm run seed:dev-auth
 *
 * Requires NEON_AUTH_BASE_URL in app/.env (loaded via --env-file in npm script).
 */

import { createAuthClient } from '@neondatabase/neon-js/auth';

const DEV_EMAIL = 'levi@broeksma.nl';
const DEV_PASSWORD = 'BB@@bb22';
const DEV_NAME = 'Levi';
/** Trusted origin on the dev Neon Auth branch (see 11-Neon-Integration.md). */
const DEV_ORIGIN = 'http://localhost:4321';

export function isAlreadyExistsError(message: string): boolean {
  return /already exists/i.test(message);
}

async function main() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) {
    console.error('NEON_AUTH_BASE_URL is required');
    process.exit(1);
  }

  const auth = createAuthClient(baseUrl);
  const result = await auth.signUp.email(
    {
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
      name: DEV_NAME,
    },
    {
      headers: { Origin: DEV_ORIGIN },
    },
  );

  if (result.error) {
    if (isAlreadyExistsError(result.error.message ?? '')) {
      console.log(`Dev user ${DEV_EMAIL} already exists — skipping.`);
      return;
    }
    console.error('Seed failed:', result.error.message);
    process.exit(1);
  }

  console.log(`Created dev user ${DEV_EMAIL}`);
}

if (!process.env.VITEST) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
