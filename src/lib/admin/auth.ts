// Password auth for /admin. One shared password (ADMIN_PASSWORD env); the session cookie is an
// HMAC derived from it, so changing the password logs everyone out. Server-only.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { json } from '../gate';

export const SESSION_COOKIE = 'sd_admin';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function env(name: string): string | undefined {
  return process.env[name] || (import.meta.env as Record<string, string | undefined>)[name];
}

export function adminPassword(): string | undefined {
  return env('ADMIN_PASSWORD');
}

function sessionToken(): string {
  const pw = adminPassword() || '';
  const key = env('DOWNLOAD_SECRET') || 'dev-secret-change-me';
  return createHmac('sha256', key).update(`admin-session:v1:${pw}`).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  const pw = adminPassword();
  if (!pw) return false;
  return safeEqual(input, pw);
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export function isAuthed(request: Request): boolean {
  const c = readCookie(request, SESSION_COOKIE);
  return !!c && !!adminPassword() && safeEqual(c, sessionToken());
}

export function sessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:';
  return `${SESSION_COOKIE}=${sessionToken()}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function clearCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:';
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** Returns a 401/403 Response if the request may not proceed, else null. */
export function guard(request: Request): Response | null {
  if (!isAuthed(request)) return json({ error: 'Please log in.' }, { status: 401 });
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Cross-origin request refused.' }, { status: 403 });
  }
  return null;
}
