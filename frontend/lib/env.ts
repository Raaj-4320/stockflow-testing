const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1';
const normalizeUrl = (value: string): string => value.replace(/\/+$|^\s+|\s+$/g, '');
export const env = { apiBaseUrl: normalizeUrl(process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL) };
export type FrontendEnv = typeof env;
