import { getAccessToken } from '@client/auth/client';

export type ApiErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorBody;
  requestId: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const UNAUTHORIZED: ApiFailure = {
  ok: false,
  requestId: '',
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    retryable: false,
  },
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  if (!token) return UNAUTHORIZED;

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...init, headers });
  const body = (await response.json()) as ApiResult<T>;
  return body;
}
