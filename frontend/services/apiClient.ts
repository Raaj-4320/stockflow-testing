import { env } from '@/lib/env';
import { ApiError, normalizeApiErrorEnvelope } from '@/lib/errors';
export type HttpMethod = 'GET' | 'POST' | 'PATCH';
export type ApiClientRequest = { path: string; method?: HttpMethod; body?: unknown; token?: string | null; headers?: Record<string, string> };
const createRequestId = () => `sf-next-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export async function apiRequest<T>(input: ApiClientRequest): Promise<T> {
  const requestId = createRequestId();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-request-id': requestId, ...(input.headers || {}) };
  if (input.token) headers.Authorization = `Bearer ${input.token}`;
  const response = await fetch(`${env.apiBaseUrl}${input.path}`, { method: input.method || 'GET', headers, body: input.body === undefined ? undefined : JSON.stringify(input.body) });
  const raw = await response.text();
  const parsed = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    const normalized = normalizeApiErrorEnvelope(parsed);
    throw new ApiError({ message: normalized.message, code: normalized.code, fieldErrors: normalized.fieldErrors, status: response.status, requestId: normalized.requestId ?? requestId });
  }
  return parsed as T;
}
