// Where content is read from and written to. The repository is the database:
// GitHubStore commits through the Git Data API; LocalStore edits the working tree in `astro dev`.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join, dirname, basename } from 'node:path';

export interface FileRead { path: string; content: string; sha: string }
export interface DirEntry { name: string; path: string; sha: string }
export interface Change { path: string; content?: string; blobSha?: string; delete?: boolean }
export interface CommitResult { sha: string; branch: string; url?: string }

export interface Store {
  readonly kind: 'github' | 'local';
  readonly branch: string;
  readFile(path: string): Promise<FileRead | null>;
  listDir(path: string): Promise<DirEntry[]>;
  createBlob(bytes: Uint8Array): Promise<string>;
  commit(message: string, changes: Change[]): Promise<CommitResult>;
}

function env(name: string): string | undefined {
  return process.env[name] || (import.meta.env as Record<string, string | undefined>)[name];
}

/** git blob sha, so local and GitHub agree on file identity. */
export function gitBlobSha(bytes: Uint8Array | string): string {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

// ---------- GitHub ----------
class GitHubStore implements Store {
  readonly kind = 'github' as const;
  constructor(private token: string, private repo: string, readonly branch: string) {}

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${this.token}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'seandobbins-admin', ...(init.headers || {}) },
    });
    if (res.status === 404 && init.method === undefined) return null as T;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub ${res.status} on ${path}: ${text.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  async readFile(path: string): Promise<FileRead | null> {
    const r = await this.api<{ content: string; sha: string; encoding: string } | null>(`/repos/${this.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(this.branch)}`);
    if (!r) return null;
    return { path, sha: r.sha, content: Buffer.from(r.content, 'base64').toString('utf8') };
  }

  async listDir(path: string): Promise<DirEntry[]> {
    const r = await this.api<{ name: string; path: string; sha: string; type: string }[] | null>(`/repos/${this.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(this.branch)}`);
    if (!r) return [];
    return r.filter((e) => e.type === 'file').map((e) => ({ name: e.name, path: e.path, sha: e.sha }));
  }

  async createBlob(bytes: Uint8Array): Promise<string> {
    const r = await this.api<{ sha: string }>(`/repos/${this.repo}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: Buffer.from(bytes).toString('base64'), encoding: 'base64' }) });
    return r.sha;
  }

  async commit(message: string, changes: Change[]): Promise<CommitResult> {
    const ref = await this.api<{ object: { sha: string } }>(`/repos/${this.repo}/git/ref/heads/${encodeURIComponent(this.branch)}`);
    const baseCommit = ref.object.sha;
    const commit = await this.api<{ tree: { sha: string } }>(`/repos/${this.repo}/git/commits/${baseCommit}`);
    const tree = await Promise.all(changes.map(async (c) => {
      if (c.delete) return { path: c.path, mode: '100644', type: 'blob', sha: null };
      if (c.blobSha) return { path: c.path, mode: '100644', type: 'blob', sha: c.blobSha };
      return { path: c.path, mode: '100644', type: 'blob', content: c.content ?? '' };
    }));
    const newTree = await this.api<{ sha: string }>(`/repos/${this.repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
    const newCommit = await this.api<{ sha: string; html_url: string }>(`/repos/${this.repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommit] }) });
    await this.api(`/repos/${this.repo}/git/refs/heads/${encodeURIComponent(this.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha, force: false }) });
    return { sha: newCommit.sha, branch: this.branch, url: newCommit.html_url };
  }
}

function encodePath(p: string): string { return p.split('/').map(encodeURIComponent).join('/'); }

// ---------- Local (astro dev) ----------
class LocalStore implements Store {
  readonly kind = 'local' as const;
  readonly branch = 'local';
  private root = process.cwd();
  private blobDir = join(process.cwd(), '.astro', 'admin-blobs');

  private abs(p: string) {
    const full = join(this.root, p);
    if (!full.startsWith(this.root)) throw new Error('Bad path');
    return full;
  }
  async readFile(path: string): Promise<FileRead | null> {
    try { const content = await fs.readFile(this.abs(path), 'utf8'); return { path, content, sha: gitBlobSha(content) }; } catch { return null; }
  }
  async listDir(path: string): Promise<DirEntry[]> {
    try {
      const names = await fs.readdir(this.abs(path));
      const out: DirEntry[] = [];
      for (const name of names) { const c = await fs.readFile(this.abs(join(path, name))); out.push({ name, path: `${path}/${name}`, sha: gitBlobSha(c) }); }
      return out;
    } catch { return []; }
  }
  async createBlob(bytes: Uint8Array): Promise<string> {
    const sha = gitBlobSha(bytes);
    await fs.mkdir(this.blobDir, { recursive: true });
    await fs.writeFile(join(this.blobDir, sha), bytes);
    return sha;
  }
  async commit(message: string, changes: Change[]): Promise<CommitResult> {
    for (const c of changes) {
      const target = this.abs(c.path);
      if (c.delete) { await fs.rm(target, { force: true }); continue; }
      await fs.mkdir(dirname(target), { recursive: true });
      if (c.blobSha) await fs.copyFile(join(this.blobDir, c.blobSha), target);
      else await fs.writeFile(target, c.content ?? '', 'utf8');
    }
    console.log(`[admin:local] ${message} (${changes.map((c) => basename(c.path)).join(', ')})`);
    return { sha: `local-${Date.now().toString(36)}`, branch: 'local' };
  }
}

export function contentBranch(): string {
  return env('CONTENT_BRANCH') || env('VERCEL_GIT_COMMIT_REF') || 'main';
}

export function getStore(): Store {
  // ADMIN_STORE=local forces the working-tree store in `astro dev` even if a GITHUB_TOKEN is around.
  if (import.meta.env.DEV && env('ADMIN_STORE') === 'local') return new LocalStore();
  const token = env('GITHUB_TOKEN');
  if (token) return new GitHubStore(token, env('GITHUB_REPO') || 'vocalsbydana/seandobbins', contentBranch());
  if (import.meta.env.DEV) return new LocalStore();
  throw new Error('The editor is not configured: set GITHUB_TOKEN (and ADMIN_PASSWORD) in Vercel. See HANDOVER.md.');
}
