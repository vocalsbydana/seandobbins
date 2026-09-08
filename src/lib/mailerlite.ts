// MailerLite (new API) subscriber upsert. Server-only.
// Docs: POST https://connect.mailerlite.com/api/subscribers  { email, fields, groups }
type Fields = Record<string, string | undefined>;

export interface SubscribeResult { ok: boolean; configured: boolean; error?: string }

export async function subscribe(opts: { email: string; group: 'drummers' | 'prospective'; fields?: Fields }): Promise<SubscribeResult> {
  const key = process.env.MAILERLITE_API_KEY || import.meta.env.MAILERLITE_API_KEY;
  const groupId = opts.group === 'drummers'
    ? (process.env.MAILERLITE_GROUP_DRUMMERS || import.meta.env.MAILERLITE_GROUP_DRUMMERS)
    : (process.env.MAILERLITE_GROUP_PROSPECTIVE || import.meta.env.MAILERLITE_GROUP_PROSPECTIVE);

  if (!key) {
    console.warn('[mailerlite] MAILERLITE_API_KEY not set — subscriber NOT recorded:', opts.email);
    return { ok: true, configured: false };
  }

  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.fields ?? {})) if (v) fields[k] = v;

  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ email: opts.email, fields, groups: groupId ? [groupId] : [] }),
  });
  if (res.ok) return { ok: true, configured: true };
  const text = await res.text().catch(() => '');
  console.error('[mailerlite] error', res.status, text);
  return { ok: false, configured: true, error: `MailerLite ${res.status}` };
}
