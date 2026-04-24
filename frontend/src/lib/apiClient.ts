import { supabase } from './supabase';

/**
 * A wrapper around native `fetch` that automatically injects the active Supabase
 * JWT Bearer token into the Authorization header to strictly authenticate API calls
 * to the Node.js backend under multi-tenancy rules.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session?.access_token) {
    console.error('apiFetch blocked: No active session token found.');
    throw new Error('Not authenticated.');
  }

  const headers = new Headers(options.headers || {});
  // Only inject if not manually populated elsewhere
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // If no content-type is provided and we are creating JSON body, automatically set it
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string' && options.body.startsWith('{')) {
    headers.set('Content-Type', 'application/json');
  }

  const updatedOptions = {
    ...options,
    headers
  };

  // Route relative `/api/...` calls to the Node.js backend
  // In development, we default to localhost:3000. In production (served by Express), we use relative paths.
  const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');
  const url = endpoint.startsWith('/') ? `${API_BASE}${endpoint}` : endpoint;

  return fetch(url, updatedOptions);
}
