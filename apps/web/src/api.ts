import type {
  AnalyticsResponse,
  AuthResponse,
  AuthUser,
  CreateUrlInput,
  LoginInput,
  RegisterInput,
  UrlDto,
} from '@url-shortener/shared';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const TOKEN_KEY = 'url-shortener.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    let message = body || `Request failed: ${res.status}`;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.message) {
        message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
      }
    } catch {
      /* body wasn't JSON */
    }
    throw new Error(message);
  }
  // 204 or empty
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  create: (input: CreateUrlInput) =>
    request<UrlDto>('/api/urls', { method: 'POST', body: JSON.stringify(input) }),
  list: (mineOnly = false) =>
    request<UrlDto[]>(`/api/urls${mineOnly ? '?mine=1' : ''}`),
  register: (input: RegisterInput) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  login: (input: LoginInput) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  me: () => request<AuthUser>('/api/auth/me'),
  analytics: (urlId: string) =>
    request<AnalyticsResponse>(`/api/urls/${urlId}/analytics`),
};
