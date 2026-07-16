import { vi } from 'vitest';
import { createAuthClientMock } from './mocks/auth-client.mock';

vi.mock('@client/auth/client', () => ({
  authClient: createAuthClientMock(),
}));
