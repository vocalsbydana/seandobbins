// Shared helpers for the /api/admin routes.
import { json } from '../gate';
import { guard } from './auth';
import { getStore, type Store } from './store';

export { json };

/** Auth + store in one step. Returns either a ready store or the Response to send back. */
export function open(request: Request): { store: Store } | { response: Response } {
  const denied = guard(request);
  if (denied) return { response: denied };
  try { return { store: getStore() }; }
  catch (e) { return { response: json({ error: (e as Error).message, configured: false }, { status: 503 }) }; }
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try { return (await request.json()) as T; } catch { return null; }
}

export function fail(e: unknown, status = 500): Response {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('[admin]', msg);
  return json({ error: msg }, { status });
}
