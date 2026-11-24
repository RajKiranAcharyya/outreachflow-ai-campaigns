export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function getAdminToken(): string {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('admin_token') || 'secret_admin_token';
  }
  return 'secret_admin_token';
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getAdminToken();

  const headers = new Headers(options.headers || {});
  if (!headers.has('x-admin-token')) {
    headers.set('x-admin-token', token);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData) && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return res;
}
