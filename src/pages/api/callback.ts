import type { APIRoute } from 'astro';

export const prerender = false;

/** Decap CMS GitHub OAuth, step 2: exchange the code for a token and hand it to the CMS window. */
export const GET: APIRoute = async ({ request }) => {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID || import.meta.env.OAUTH_GITHUB_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET || import.meta.env.OAUTH_GITHUB_CLIENT_SECRET;
  const code = new URL(request.url).searchParams.get('code');
  if (!clientId || !clientSecret) return new Response('OAuth is not configured. See HANDOVER.md.', { status: 500 });
  if (!code) return new Response('Missing code', { status: 400 });

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  const ok = Boolean(data.access_token);
  const payload = ok ? JSON.stringify({ token: data.access_token, provider: 'github' }) : JSON.stringify({ error: data.error_description || data.error || 'Unknown error' });
  const status = ok ? 'success' : 'error';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Signing in…</title>
<style>body{font-family:system-ui,sans-serif;background:#0B0B14;color:#F3EEE5;display:grid;place-items:center;height:100vh;margin:0}</style></head>
<body><p>${ok ? 'Signed in. You can close this window.' : 'Sign-in failed: ' + (data.error_description || data.error || '')}</p>
<script>
(function () {
  var message = 'authorization:github:${status}:' + ${JSON.stringify(payload)};
  function receive(e) { window.opener.postMessage(message, e.origin); window.removeEventListener('message', receive, false); }
  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`;
  return new Response(html, { status: ok ? 200 : 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
};
