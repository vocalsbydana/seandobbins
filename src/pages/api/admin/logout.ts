import type { APIRoute } from 'astro';
import { clearCookie } from '../../../lib/admin/auth';
import { json } from '../../../lib/admin/common';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => json({ ok: true }, { headers: { 'set-cookie': clearCookie(request) } });
