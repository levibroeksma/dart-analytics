# Login Page & Client Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hosted Neon Auth redirect stub with a themed in-app login form, a client-side auth gate for prerendered routes (D97), and auto-provision on first sign-in.

**Architecture:** `@neondatabase/neon-js/auth` handles sign-in/session caching; `auth.store.ts` runs the navigation gate in `BaseLayout`; `login.data.ts` orchestrates sign-in then `POST /api/players/provision`. All behavior is developed test-first with Vitest (D99).

**Tech Stack:** Astro 7, Alpine.js 3, Vitest, `@neondatabase/neon-js`, `@alpinejs/persist`, Tailwind 4, Zod, Cloudflare Workers adapter.

**Spec:** `docs/superpowers/specs/2026-07-15-login-page-design.md`

## Global Constraints

- **TDD mandatory (D99):** Every task follows red → green → refactor. Write failing test → `npm test` fails → implement → `npm test` passes → commit. No production behavior without a preceding failing test.
- **Prerequisite:** Theme in `global.css`; middleware + provision endpoint exist.
- **D97:** Client gate in `BaseLayout` is load-bearing navigation UX; API JWT is the security boundary.
- **No `x-init`** — gate in `auth.store` `init()` only.
- `**x-data="factory()"**` always.
- **Import direction:** `login.data.ts` orchestrates `@client/api`; `auth.store` wraps SDK only.
- **Browser code** must not import `lib/env.ts` or server auth.
- `**PUBLIC_NEON_AUTH_BASE_URL**` for browser.
- **Form controls** in `components/forms/`.
- **Alpine v3 shorthand (D100):** `:class`, `:disabled`, `@click`, `@submit.prevent` — never `x-bind:`_ / `x-on:_`except`x-on:\*`inside Astro`{}`when linter blocks`@`
- **Final gate:** `npm run validate:app` (includes `npm test`).

---

### Task 0: Vitest test infrastructure

**Files:**

- Create: `app/vitest.config.ts`
- Modify: `app/package.json`

**Interfaces:**

- Produces: `npm test` → `vitest run`; `npm run test:watch` → `vitest`

- [ ] **Step 1: Install Vitest**

```bash
cd app && npm install -D vitest
```

- [ ] **Step 2: Create `app/vitest.config.ts`**

```typescript
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, './src/lib/client'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@forms': path.resolve(__dirname, './src/forms'),
      '@types': path.resolve(__dirname, './src/types'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@pages': path.resolve(__dirname, './src/pages'),
    },
  },
});
```

- [ ] **Step 3: Add scripts to `app/package.json`**

```json
"test": "vitest run",
"test:watch": "vitest",
"validate:app": "npm run db:status && npm run db:migrate && npm run db:introspect && npx fallow && npm test && astro check && bash ../scripts/refresh-graph.sh"
```

- [ ] **Step 4: Write smoke test (proves runner works)**

Create `app/src/vitest-smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd app && npm test
```

Expected: PASS (1 test).

- [ ] **Step 6: Delete smoke test** (optional — or keep until Task 1 adds real tests)

```bash
rm app/src/vitest-smoke.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add app/vitest.config.ts app/package.json app/package-lock.json
git commit -m "chore(app): add Vitest and wire npm test into validate:app (D99)"
```

---

### Task 1: Shared utilities (`cn`, `auth-routes`)

**Files:**

- Modify: `app/package.json` (deps from original plan)
- Modify: `app/tsconfig.json`
- Create: `app/src/lib/client/cn.ts`
- Create: `app/src/lib/client/cn.test.ts`
- Create: `app/src/utils/auth-routes.ts`
- Create: `app/src/utils/auth-routes.test.ts`
- Modify: `app/.env.example`

**Interfaces:**

- Produces: `cn()`, `normalizePath()`, `isPublicPage()`, `PUBLIC_PAGES`

- [ ] **Step 1: Write failing tests for `auth-routes`**

Create `app/src/utils/auth-routes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isPublicPage, normalizePath, PUBLIC_PAGES } from './auth-routes';

describe('normalizePath', () => {
  it('strips trailing slash', () => {
    expect(normalizePath('/login/')).toBe('/login');
  });

  it('keeps root', () => {
    expect(normalizePath('/')).toBe('/');
  });
});

describe('isPublicPage', () => {
  it('returns true for /login', () => {
    expect(isPublicPage('/login')).toBe(true);
  });

  it('returns true for /login/ with trailing slash', () => {
    expect(isPublicPage('/login/')).toBe(true);
  });

  it('returns false for protected routes', () => {
    expect(isPublicPage('/')).toBe(false);
    expect(isPublicPage('/games')).toBe(false);
  });
});

describe('PUBLIC_PAGES', () => {
  it('contains /login only in v1', () => {
    expect(PUBLIC_PAGES).toEqual(new Set(['/login']));
  });
});
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
cd app && npm test src/utils/auth-routes.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write failing test for `cn`**

Create `app/src/lib/client/cn.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('merges conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('joins non-conflicting classes', () => {
    expect(cn('btn', 'btn-primary')).toBe('btn btn-primary');
  });
});
```

- [ ] **Step 4: Run cn test — verify FAIL**

```bash
cd app && npm test src/lib/client/cn.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Install deps and implement utilities**

```bash
cd app && npm install @neondatabase/neon-js @alpinejs/persist clsx tailwind-merge
```

Implement `app/src/utils/auth-routes.ts` and `app/src/lib/client/cn.ts` per spec.

Add tsconfig aliases and `.env.example` `PUBLIC_NEON_AUTH_BASE_URL` per original plan Task 1.

- [ ] **Step 6: Run all tests — verify PASS**

```bash
cd app && npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/utils/auth-routes.ts app/src/utils/auth-routes.test.ts app/src/lib/client/cn.ts app/src/lib/client/cn.test.ts app/tsconfig.json app/.env.example app/package.json app/package-lock.json
git commit -m "feat(app): add cn and auth-routes utilities with tests"
```

---

### Task 2: Form components (`Input`, `Button`)

**Files:**

- Create: `app/src/components/forms/button-variants.ts`
- Create: `app/src/components/forms/button-variants.test.ts`
- Create: `app/src/components/forms/Input.astro`
- Create: `app/src/components/forms/Button.astro`

**Interfaces:**

- Produces: `buttonVariantClass(variant)`, themed Astro form components

- [ ] **Step 1: Write failing test for button variants**

Create `app/src/components/forms/button-variants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buttonVariantClass } from './button-variants';

describe('buttonVariantClass', () => {
  it('maps primary to btn-primary', () => {
    expect(buttonVariantClass('primary')).toBe('btn-primary');
  });

  it('maps secondary to btn-secondary', () => {
    expect(buttonVariantClass('secondary')).toBe('btn-secondary');
  });

  it('maps ghost to btn-ghost', () => {
    expect(buttonVariantClass('ghost')).toBe('btn-ghost');
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
cd app && npm test src/components/forms/button-variants.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `button-variants.ts`**

```typescript
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};

export function buttonVariantClass(variant: ButtonVariant): string {
  return VARIANT_CLASS[variant];
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
cd app && npm test src/components/forms/button-variants.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create `Input.astro` and `Button.astro`**

`Button.astro` imports `buttonVariantClass` and `cn` per spec Section 2. `Input.astro` per spec.

- [ ] **Step 6: Verify types**

```bash
cd app && npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/forms/
git commit -m "feat(app): add themed form components with tested variant map"
```

---

### Task 3: API types and client layer

**Files:**

- Create: `app/src/types/api/players.ts`
- Create: `app/src/types/api/players.test.ts`
- Create: `app/src/types/api/index.ts`
- Create: `app/src/lib/client/auth/client.ts`
- Create: `app/src/lib/client/auth/client.test.ts`
- Create: `app/src/lib/client/api/client.ts`
- Create: `app/src/lib/client/api/client.test.ts`
- Create: `app/src/lib/client/api/players.ts`
- Create: `app/src/lib/client/api/players.test.ts`

**Interfaces:**

- Produces: Zod schemas, `getAccessToken()`, `apiRequest<T>()`, `provision()`

- [ ] **Step 1: Write failing Zod schema tests**

Create `app/src/types/api/players.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ProvisionPlayerRequest, ProvisionPlayerResponse } from './players';

describe('ProvisionPlayerRequest', () => {
  it('accepts empty object', () => {
    expect(ProvisionPlayerRequest.safeParse({}).success).toBe(true);
  });

  it('accepts displayName', () => {
    expect(
      ProvisionPlayerRequest.safeParse({ displayName: 'Levi' }).success,
    ).toBe(true);
  });

  it('rejects empty displayName', () => {
    expect(ProvisionPlayerRequest.safeParse({ displayName: '' }).success).toBe(
      false,
    );
  });
});

describe('ProvisionPlayerResponse', () => {
  it('parses valid response', () => {
    const result = ProvisionPlayerResponse.safeParse({
      playerId: '018f1234-5678-7000-8000-000000000001',
      authUserId: 'auth-1',
      created: true,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd app && npm test src/types/api/players.test.ts
```

- [ ] **Step 3: Implement `players.ts` schemas + barrel**

Per spec Task 3.

- [ ] **Step 4: Run schema tests — verify PASS**

```bash
cd app && npm test src/types/api/players.test.ts
```

- [ ] **Step 5: Write failing `apiRequest` test**

Create `app/src/lib/client/api/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/auth/client', () => ({
  getAccessToken: vi.fn(),
}));

import { getAccessToken } from '@client/auth/client';
import { apiRequest } from './client';

describe('apiRequest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns UNAUTHORIZED when no token', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(null);
    const result = await apiRequest('/api/players/provision');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('attaches Bearer header and parses success envelope', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('test-jwt');
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        data: { playerId: 'p1', authUserId: 'a1', created: true },
        requestId: 'req-1',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest('/api/players/provision', {
      method: 'POST',
      body: '{}',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/players/provision',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-jwt');
    expect(result.ok).toBe(true);

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 6: Run — verify FAIL**

```bash
cd app && npm test src/lib/client/api/client.test.ts
```

- [ ] **Step 7: Implement `client.ts`, `auth/client.ts`, `players.ts`**

Implement `getAccessToken` reading session token from Neon SDK (adjust field name to match installed types).

- [ ] **Step 8: Write failing `provision` test**

Create `app/src/lib/client/api/players.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from './client';
import { provision, ProvisionError } from './players';

describe('provision', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns parsed data on success', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: 'r1',
      data: { playerId: 'p1', authUserId: 'a1', created: true },
    });
    const result = await provision({ displayName: 'Levi' });
    expect(result.created).toBe(true);
  });

  it('throws ProvisionError on api failure', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: 'r1',
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        retryable: false,
      },
    });
    await expect(provision()).rejects.toBeInstanceOf(ProvisionError);
  });
});
```

- [ ] **Step 9: Run all client tests — verify PASS**

```bash
cd app && npm test src/lib/client src/types/api
```

- [ ] **Step 10: Commit**

```bash
git add app/src/types/api app/src/lib/client
git commit -m "feat(app): add typed API client and provision wrapper with tests"
```

---

### Task 4: Auth store and Alpine factory

**Files:**

- Create: `app/src/stores/auth.store.ts`
- Create: `app/src/stores/auth.store.test.ts`
- Create: `app/src/lib/client/alpine/*`
- Modify: `app/astro.config.mjs`

**Interfaces:**

- Produces: `authStore()` with `init()`, `signIn()`; Alpine factory wired

- [ ] **Step 1: Write failing auth store tests**

Create `app/src/stores/auth.store.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/auth/client', () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
  },
}));

import { authClient } from '@client/auth/client';
import { authStore } from './auth.store';

describe('authStore.signIn', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets authenticated on success', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: {},
      error: null,
    });
    const store = authStore();
    await store.signIn('a@b.nl', 'secret');
    expect(store.status).toBe('authenticated');
  });

  it('throws on SDK error', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });
    const store = authStore();
    await expect(store.signIn('a@b.nl', 'wrong')).rejects.toThrow(
      'Invalid credentials',
    );
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd app && npm test src/stores/auth.store.test.ts
```

- [ ] **Step 3: Implement `auth.store.ts` and Alpine factory chain**

`register-route-data.ts` starts empty (loginForm added in Task 5). Wire `astro.config.mjs` entrypoint.

- [ ] **Step 4: Run store tests — verify PASS**

```bash
cd app && npm test src/stores/auth.store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/src/stores app/src/lib/client/alpine app/astro.config.mjs
git commit -m "feat(app): add auth store and Alpine factory with tests"
```

---

### Task 5: Login page, login data, and BaseLayout gate

**Files:**

- Create: `app/src/pages/login/login.data.ts`
- Create: `app/src/pages/login/login.data.test.ts`
- Create: `app/src/pages/login/index.astro`
- Delete: `app/src/pages/login.astro`
- Modify: `app/src/layouts/BaseLayout.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`

- [ ] **Step 1: Write failing login.data tests**

Create `app/src/pages/login/login.data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/api/players', () => ({
  provision: vi.fn(),
  ProvisionError: class ProvisionError extends Error {},
}));
vi.mock('@client/auth/client', () => ({
  authClient: {
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { name: 'Levi' } } } }),
  },
}));

import { provision } from '@client/api/players';
import { loginForm } from './login.data';

describe('loginForm.submit', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls provision after signIn and redirects', async () => {
    vi.mocked(provision).mockResolvedValue({
      playerId: 'p1',
      authUserId: 'a1',
      created: true,
    });
    const replace = vi.fn();
    vi.stubGlobal('location', { replace });

    const form = loginForm();
    form.$store = {
      auth: {
        signIn: vi.fn().mockResolvedValue(undefined),
      },
    };
    form.email = 'levi@broeksma.nl';
    form.password = 'admin';

    await form.submit();

    expect(provision).toHaveBeenCalledWith({ displayName: 'Levi' });
    expect(replace).toHaveBeenCalledWith('/');

    vi.unstubAllGlobals();
  });

  it('sets error message on signIn failure', async () => {
    const form = loginForm();
    form.$store = {
      auth: {
        signIn: vi
          .fn()
          .mockRejectedValue(new Error('Invalid email or password')),
      },
    };
    await form.submit();
    expect(form.error).toBe('Email or password is incorrect.');
    expect(form.loading).toBe(false);
  });
});
```

Note: export `mapSignInError` separately if `$store` mocking is awkward — test pure helper first (red → green), then wire `loginForm`.

- [ ] **Step 2: Run — verify FAIL**

```bash
cd app && npm test src/pages/login/login.data.test.ts
```

- [ ] **Step 3: Implement markup with Alpine v3 shorthand (D100)**

`app/src/layouts/BaseLayout.astro` body:

```astro
<body
  class="flex flex-col"
  x-data
  x-cloak
  :class="{ invisible: !$store.auth.ready }"
>
  <slot />
</body>
```

`app/src/pages/login/index.astro` form (native elements — shorthand required):

```astro
<form x-data="loginForm()" @submit.prevent="submit" class="space-y-4">
  <Input label="Email" type="email" name="email" autocomplete="email" x-model="email" required />
  <Input label="Password" type="password" name="password" autocomplete="current-password" x-model="password" required />
  <p x-show="error" x-text="error" class="text-sm text-destructive" role="alert"></p>
  <Button type="submit" variant="primary" class="w-full" :disabled="loading">
    <span x-show="!loading">Sign in</span>
    <span x-show="loading">Signing in…</span>
  </Button>
</form>
```

Forbidden in this task: `x-bind:class`, `x-bind:disabled`, `x-on:submit`, `x-on:click` on native elements.

Implement `login.data.ts`, register `loginForm` in `register-route-data.ts`. Add `[x-cloak] { display: none !important; }` to `global.css` `@layer base` if missing.

- [ ] **Step 4: Run tests — verify PASS**

```bash
cd app && npm test src/pages/login/login.data.test.ts
```

- [ ] **Step 5: Delete old login route**

```bash
rm app/src/pages/login.astro
```

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/login app/src/layouts/BaseLayout.astro app/src/styles/global.css
git commit -m "feat(app): add login form, auth gate, and login.data tests"
```

---

### Task 6: Middleware `PUBLIC_PAGES` deduplication

**Files:**

- Modify: `app/src/middleware.ts`
- Create: `app/src/middleware.test.ts`

- [ ] **Step 1: Extract `classifyRoute` to testable module OR test via exported helper**

Create `app/src/utils/route-class.ts`:

```typescript
import { isPublicPage, normalizePath } from './auth-routes';

export type RouteClass =
  | 'public-page'
  | 'asset'
  | 'api-provision'
  | 'api-protected'
  | 'protected-page';

const PROVISION_ROUTE = '/api/players/provision';

export function classifyRoute(path: string): RouteClass {
  if (path === PROVISION_ROUTE) return 'api-provision';
  if (path.startsWith('/api/')) return 'api-protected';
  if (isPublicPage(normalizePath(path))) return 'public-page';
  if (path.includes('.')) return 'asset';
  return 'protected-page';
}
```

- [ ] **Step 2: Write failing tests**

Create `app/src/utils/route-class.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyRoute } from './route-class';

describe('classifyRoute', () => {
  it('classifies /login as public-page', () => {
    expect(classifyRoute('/login')).toBe('public-page');
  });

  it('classifies /login/ as public-page', () => {
    expect(classifyRoute('/login/')).toBe('public-page');
  });

  it('classifies provision endpoint', () => {
    expect(classifyRoute('/api/players/provision')).toBe('api-provision');
  });

  it('classifies / as protected-page', () => {
    expect(classifyRoute('/')).toBe('protected-page');
  });
});
```

- [ ] **Step 3: Run — verify FAIL, implement, run — verify PASS**

```bash
cd app && npm test src/utils/route-class.test.ts
```

- [ ] **Step 4: Update `middleware.ts` to use `classifyRoute`**

- [ ] **Step 5: Commit**

```bash
git add app/src/utils/route-class.ts app/src/utils/route-class.test.ts app/src/middleware.ts
git commit -m "refactor(app): extract classifyRoute with tests; dedupe PUBLIC_PAGES"
```

---

### Task 7: Neon Auth dev setup and seed script

**Files:**

- Create: `app/scripts/seed-dev-auth.ts`
- Create: `app/scripts/seed-dev-auth.test.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Write failing test for signup error helper**

Create `app/scripts/seed-dev-auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isAlreadyExistsError } from './seed-dev-auth';

describe('isAlreadyExistsError', () => {
  it('detects existing user messages', () => {
    expect(isAlreadyExistsError('User already exists')).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isAlreadyExistsError('Network failure')).toBe(false);
  });
});
```

Export `isAlreadyExistsError` from `seed-dev-auth.ts` for testability.

- [ ] **Step 2: Run — verify FAIL, implement script + helper, run — verify PASS**

Add `"seed:dev-auth": "tsx scripts/seed-dev-auth.ts"`.

Configure Neon Auth on dev branch (MCP/manual).

- [ ] **Step 3: Commit**

```bash
git add app/scripts/seed-dev-auth.ts app/scripts/seed-dev-auth.test.ts app/package.json
git commit -m "chore(app): add dev auth seed script with tests"
```

---

### Task 8: Documentation and Context Maintenance

**Files:**

- Modify: `DECISIONS.md` (D98 + D99 + D100 if not committed earlier)
- Modify: `docs/architecture/07-Frontend/01-Rendering-Strategy.md`
- Modify: `docs/architecture/05-Database/11-Neon-Integration.md`
- Modify: `docs/architecture/00-Context-Map.md`

- [ ] **Step 1: Apply doc updates per spec**

Include D98 client gate; D99 TDD; D100 Alpine v3 shorthand in `11-Neon-Integration` dev setup section.

- [ ] **Step 2: Run context checker**

```bash
bash scripts/check-context-map.sh
```

Expected: OK

- [ ] **Step 3: Commit**

```bash
git add DECISIONS.md docs/architecture/
git commit -m "docs: record client auth gate (D98), TDD (D99), Alpine v3 shorthand (D100)"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full validation**

```bash
cd app && npm run validate:app
```

Expected: PASS including `npm test`.

- [ ] **Step 2: Manual auth smoke** (Neon connected)

| #   | Action                                           | Expected                        |
| --- | ------------------------------------------------ | ------------------------------- |
| 1   | Logged out → `/`                                 | Redirect `/login`, no nav flash |
| 2   | Sign in dev user                                 | Land on `/` with nav            |
| 3   | `/login` while signed in                         | Redirect `/`                    |
| 4   | `curl -X POST .../api/players/provision` no auth | 401                             |

- [ ] **Step 3: Graph refresh + commit if changed**

```bash
bash scripts/refresh-graph.sh
```

---

## Spec Coverage Self-Review

| Spec requirement           | Task                |
| -------------------------- | ------------------- |
| TDD for all behavior       | Task 0 + every task |
| Themed login form          | Task 2, 5           |
| Client auth gate           | Task 4, 5           |
| Auto-provision             | Task 3, 5           |
| Dev user seed              | Task 7              |
| Shared PUBLIC_PAGES        | Task 1, 6           |
| Doc updates                | Task 8              |
| Alpine v3 shorthand (D100) | Task 5 markup       |

## Doc Compliance Self-Review

| Doc rule                           | Plan                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| D99 / `app/CLAUDE.md` TDD          | Task 0; red-green in every task                                                 |
| D100 Alpine v3 shorthand           | Task 5: `:class`, `@submit`, `:disabled`; no `x-bind`/`x-on` on native elements |
| `10-Frontend-Agent-Guide` §2 + §10 | Shorthand + TDD                                                                 |
| `03-Engineering-Workflow` Phase 8  | `npm test` in validate                                                          |
| `02` import direction              | Task 4 store vs Task 5 data                                                     |
| `05` cn + forms/                   | Task 1, 2                                                                       |
| Context Maintenance                | Task 8                                                                          |

---

**Plan complete.** Execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — tasks in this session with checkpoints

Which approach?
