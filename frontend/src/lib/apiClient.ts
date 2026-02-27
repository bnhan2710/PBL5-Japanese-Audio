/**
 * Centralized API client with automatic JWT refresh.
 *
 * On a 401 response, the client will:
 *  1. Call POST /api/auth/refresh with the stored refresh_token
 *  2. Save the new token pair to localStorage
 *  3. Retry the original request with the new access_token
 *  4. If the refresh itself fails, clear tokens and call the registered logout callback
 *
 * Concurrent 401s are queued so only one refresh call is ever in-flight at a time.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Refresh queue (handles concurrent 401s)
// ---------------------------------------------------------------------------

type QueueItem = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
};

let isRefreshing = false;
let refreshQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
}

// ---------------------------------------------------------------------------
// Logout callback – registered by AuthProvider
// ---------------------------------------------------------------------------

let logoutCallback: (() => void) | null = null;

export function registerLogoutCallback(cb: () => void) {
  logoutCallback = cb;
}

// ---------------------------------------------------------------------------
// Internal: perform the token refresh
// ---------------------------------------------------------------------------

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token available');

  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    throw new Error('Token refresh failed');
  }

  const data: { access_token: string; refresh_token: string } = await res.json();
  localStorage.setItem('token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Public: apiFetch – drop-in replacement for fetch()
// ---------------------------------------------------------------------------

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('token');

  // Build headers, injecting Authorization automatically
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // Set JSON content-type unless it's a multipart upload
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(input, { ...init, headers });

  // Return early for non-401 or if there is no refresh token to try
  if (response.status !== 401 || !localStorage.getItem('refresh_token')) {
    return response;
  }

  // ---------------------------------------------------------------------------
  // 401 handling: refresh token then retry
  // ---------------------------------------------------------------------------

  if (isRefreshing) {
    // Another request is already refreshing – queue this one
    const newToken = await new Promise<string>((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
    const retryHeaders = new Headers(init.headers);
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    if (!retryHeaders.has('Content-Type') && !(init.body instanceof FormData)) {
      retryHeaders.set('Content-Type', 'application/json');
    }
    return fetch(input, { ...init, headers: retryHeaders });
  }

  isRefreshing = true;

  try {
    const newToken = await doRefresh();
    processQueue(null, newToken);

    const retryHeaders = new Headers(init.headers);
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    if (!retryHeaders.has('Content-Type') && !(init.body instanceof FormData)) {
      retryHeaders.set('Content-Type', 'application/json');
    }
    response = await fetch(input, { ...init, headers: retryHeaders });
  } catch (err) {
    processQueue(err, null);
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    logoutCallback?.();
    throw err;
  } finally {
    isRefreshing = false;
  }

  return response;
}
