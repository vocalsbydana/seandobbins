// Email gate helpers shared by the API routes. Server-only.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'barbershop_unlocked';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // ~2 years

function secret(): string {
  const s = process.env.DOWNLOAD_SECRET || import.meta.env.DOWNLOAD_SECRET;
  if (!s && import.meta.env.PROD) console.warn('[gate] DOWNLOAD_SECRET is not set; using dev secret.');
  return s || 'dev-secret-change-me';
}

export function fileHash(slug: string): string {
  return createHash('sha256').update(`${slug}:${secret()}`).digest('hex').slice(0, 32);
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Cookie value: "<issuedAt>.<hmac>" — not HttpOnly so the browser can skip the modal; the server verifies the signature. */
export function mintCookieValue(): string {
  const ts = Date.now().toString(36);
  return `${ts}.${sign(ts)}`;
}

export function verifyCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const [ts, sig] = value.split('.');
  if (!ts || !sig) return false;
  const expected = sign(ts);
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function cookieHeader(value: string, secure: boolean): string {
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Best-effort in-memory rate limiter (per serverless instance). Enough to stop naive abuse; no external store needed. */
const buckets = new Map<string, number[]>();
export function rateLimited(key: string, limit = 6, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) { buckets.set(key, hits); return true; }
  hits.push(now); buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return false;
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } });
}
