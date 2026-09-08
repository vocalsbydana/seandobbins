import type { APIRoute } from 'astro';

export const prerender = false;

/** Decap CMS GitHub OAuth, step 1: send the editor to GitHub. Requires OAUTH_GITHUB_CLIENT_ID. */
export const GET: APIRoute = async ({ request, redirect }) => {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID || import.meta.env.OAUTH_GITHUB_CLIENT_ID;
  if (!clientId) return new Response('OAUTH_GITHUB_CLIENT_ID is not configured. See HANDOVER.md.', { status: 500 });
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${url.origin}/api/callback`,
    scope: url.searchParams.get('scope') || 'repo,user',
    state,
  });
  return redirect(`https://github.com/login/oauth/authorize?${params}`, 302, );
};
