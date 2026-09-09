import type { APIRoute } from 'astro';
import { isAuthed } from '../../../lib/admin/auth';
import { json } from '../../../lib/admin/common';
import { getStore, contentBranch } from '../../../lib/admin/store';

export const prerender = false;

/** Who am I / is the editor configured. Safe to call logged out (returns authed:false). */
export const GET: APIRoute = async ({ request }) => {
  const authed = isAuthed(request);
  let configured = true, kind: 'github' | 'local' | null = null, error: string | undefined;
  try { const s = getStore(); kind = s.kind; } catch (e) { configured = false; error = (e as Error).message; }
  const repo = process.env.GITHUB_REPO || import.meta.env.GITHUB_REPO || 'vocalsbydana/seandobbins';
  return json({ authed, configured, kind, branch: contentBranch(), repo, error }, { headers: { 'cache-control': 'no-store' } });
};
