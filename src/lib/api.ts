import type { ApiErrorBody, ApiResponse } from '@shared/api';

// Browser calls go to /api/* on the same origin.
// Next.js rewrites forward them to Express (next.config.mjs).
//
// Keep NEXT_PUBLIC_API_URL unset so paths stay relative. Only set it to an
// absolute URL if the API should be called on a separate domain directly.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

type Params = Record<string, string | number | boolean | null | undefined>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = 'UNKNOWN',
    readonly details?: ApiErrorBody['details'],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parse<T>(res: Response): Promise<ApiResponse<T>> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    // Proxy / cold-start pages (502, 504…) aren't JSON
    throw new ApiError(res.statusText || 'Server unavailable', res.status, 'BAD_RESPONSE');
  }
}

function toError(res: Response, json: ApiResponse<unknown>): ApiError {
  const err = json.errors?.[0];
  return new ApiError(err?.message ?? 'Request failed', res.status, err?.code, err?.details);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const json = await parse<T>(res);
  if (json.status === 'error' || !res.ok) throw toError(res, json);
  return json.data;
}

function buildQS(params?: Params): string {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function requestList<T>(path: string, params?: Params): Promise<{ data: T; pagination: unknown }> {
  const res = await fetch(`${BASE_URL}/api${path}${buildQS(params)}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await parse<T>(res);
  if (json.status === 'error' || !res.ok) throw toError(res, json);
  return { data: json.data, pagination: json.meta.pagination };
}

const json = (body: unknown) => (body !== undefined ? JSON.stringify(body) : undefined);

export const api = {
  get:      <T>(path: string, params?: Params, signal?: AbortSignal) => request<T>(`${path}${buildQS(params)}`, { signal }),
  getList:  <T>(path: string, params?: Params) => requestList<T>(path, params),
  post:     <T>(path: string, body?: unknown)  => request<T>(path, { method: 'POST',  body: json(body) }),
  postForm: <T>(path: string, form: FormData)  => request<T>(path, { method: 'POST',  body: form }),
  patch:    <T>(path: string, body?: unknown)  => request<T>(path, { method: 'PATCH', body: json(body) }),
  put:      <T>(path: string, body?: unknown)  => request<T>(path, { method: 'PUT',   body: json(body) }),
  delete:   <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
};
