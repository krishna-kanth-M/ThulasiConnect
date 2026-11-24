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

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (!token) {
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

  // 1. Try real live backend first
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body,
    });

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && (contentType.includes('application/json') || response.status === 204)) {
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    }

    // If the server explicitly returned an intentional API error (e.g. 401, 403, 422, 400 with JSON)
    if (!response.ok && contentType.includes('application/json') && response.status !== 404) {
      let detail = `Request failed (${response.status})`;
      try {
        const errJson = await response.json();
        if (typeof errJson.detail === 'string') {
          detail = errJson.detail;
        } else if (Array.isArray(errJson.detail) && errJson.detail[0]?.msg) {
          detail = errJson.detail.map((d: any) => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join('; ');
        }
      } catch {
        // ignore
      }
      throw new ApiError(response.status, detail);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Fall through to mock showcase data when fetch fails or returns 404 HTML on static hosts
  }

  // 2. Showcase / Preview fallback for public viewers when live backend is offline
  const mock = getMockResponse<T>(path, options);
  if (mock !== undefined) {
    return mock;
  }

  throw new ApiError(503, 'Service unavailable. Live backend connection required.');
}

export async function downloadCsvReport(path: string, fallbackFilename: string): Promise<void> {
  try {
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
  } catch {
    // Fall through to mock CSV export
  }

  // Showcase fallback CSV
  const csvContent =
    'branch_code,branch_name,calls,requests,resolved,overdue,escalations\n' +
    'CBE-RSP,Coimbatore - RS Puram Main,58,52,48,1,1\n' +
    'CBE-GP,Coimbatore - Gandhipuram Central,6,4,3,1,0\n' +
    'MDU-KKN,Madurai - KK Nagar Hub,22,20,19,0,0\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
