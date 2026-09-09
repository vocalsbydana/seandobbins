// Minimal YAML frontmatter for the flat schemas this site uses (strings, numbers, booleans, dates).
export type Scalar = string | number | boolean;
export interface Parsed { data: Record<string, Scalar>; body: string }

export function parse(text: string): Parsed {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  const data: Record<string, Scalar> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, raw] = kv;
    data[key] = parseScalar(raw.trim());
  }
  return { data, body: m[2].replace(/^\n/, '') };
}

function parseScalar(raw: string): Scalar {
  if (raw === '' || raw === '""' || raw === "''") return '';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith('"')) { try { return JSON.parse(raw); } catch { /* fall through */ } }
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  return raw;
}

export function serialize(data: Record<string, Scalar | undefined>, body = ''): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (typeof v === 'number' || typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) lines.push(`${k}: ${v}`);
    else lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  lines.push('---');
  return lines.join('\n') + '\n' + (body ? body.replace(/\s+$/, '') + '\n' : '');
}
