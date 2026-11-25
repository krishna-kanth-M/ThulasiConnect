import { getMockResponse } from './mockData';

const TOKEN_KEY = 'tc_access_token';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Validates that a token strictly conforms to standard signed JWT format (header.payload.signature).
 * Any arbitrary string, empty value, or legacy mock string (e.g. mock_jwt_token_...) is immediately rejected.
 */
export function isValidJwtFormat(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  // All three parts must be non-empty base64url-compliant characters
  return parts.every((part) => part.length > 0 && /^[a-zA-Z0-9_-]+$/.test(part));
}

/**
 * Retrieves the stored JWT token.
 * If the stored token is missing, expired, or does not match a valid cryptographic JWT format,
 * it is immediately purged from both sessionStorage and localStorage.
 */
export function getStoredToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  if (!isValidJwtFormat(token)) {
    // Purge invalid, corrupted, or mock tokens immediately
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

export function setStoredToken(token: string | null): void {
  if (!token || !isValidJwtFormat(token)) {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getWebSocketUrl(path: string): string {
  const explicitWs = (import.meta.env.VITE_WS_BASE_URL || '').replace(/\/$/, '');
  if (explicitWs) {
    return `${explicitWs}${path}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    formData?: FormData;
    skipAuth?: boolean;
  } = {},
): Promise<T> {
  const isAuthEndpoint = path.startsWith('/api/auth/');
  const headers: Record<string, string> = {};

  if (!options.skipAuth) {
    const token = getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  // 1. Execute live backend HTTP request
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body,
    });

    const contentType = response.headers.get('content-type') || '';

    // Success response with JSON or 204 No Content
    if (response.ok && (contentType.includes('application/json') || response.status === 204)) {
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    }

    // Static server rewrite intercept (e.g. Vercel returning index.html on POST or missing backend)
    if (response.status === 405 || (contentType.includes('text/html') && path.startsWith('/api/'))) {
      throw new ApiError(
        503,
        'Backend API service is currently unavailable or not connected (HTTP 405 / Static Rewrite).',
      );
    }

    // Server returned a structured JSON error response (e.g. 401 Unauthorized, 403 Forbidden, 422 Unprocessable)
    if (contentType.includes('application/json')) {
      let detail = `Request failed (${response.status})`;
      try {
        const errJson = await response.json();
        if (typeof errJson.detail === 'string') {
          detail = errJson.detail;
        } else if (Array.isArray(errJson.detail) && errJson.detail[0]?.msg) {
          detail = errJson.detail.map((d: any) => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join('; ');
        }
      } catch {
        // ignore JSON parse error
      }
      throw new ApiError(response.status, detail);
    }

    // Standard HTTP error codes without JSON body
    if (response.status === 401) {
      throw new ApiError(401, 'Invalid email or password.');
    }
    if (response.status === 403) {
      throw new ApiError(403, 'Access denied. You do not have permission to access this resource.');
    }
    if (response.status === 404) {
      throw new ApiError(404, `Requested API endpoint not found: ${path}`);
    }

    throw new ApiError(response.status, `Server returned HTTP ${response.status}.`);
  } catch (err) {
    // If it's already an ApiError from the response inspection, rethrow directly
    if (err instanceof ApiError) {
      throw err;
    }

    // Network level failure (connection refused, DNS failure, CORS, offline)
    if (isAuthEndpoint) {
      throw new ApiError(
        503,
        'Unable to connect to the authentication server. Please check your network connection or verify that the backend is running.',
      );
    }

    // In production builds, never silently swallow errors
    if (import.meta.env.PROD) {
      throw new ApiError(
        503,
        'Backend service unavailable. Please ensure the production API server is connected.',
      );
    }
  }

  // 2. Strict development-only fallback for non-auth UI inspection (never runs for /api/auth/ or in production)
  if (!isAuthEndpoint && !import.meta.env.PROD && import.meta.env.VITE_ENABLE_DEV_MOCK_FALLBACK === 'true') {
    const mock = getMockResponse<T>(path, options);
    if (mock !== undefined) {
      return mock;
    }
  }

  throw new ApiError(503, 'Service unavailable. Live backend connection required.');
}

export async function downloadCsvReport(path: string, fallbackFilename: string): Promise<void> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (response.ok) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  throw new ApiError(response.status, 'Unable to generate CSV export from the server.');
}
