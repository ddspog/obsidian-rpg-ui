/**
 * The GM link's side of GitHub: commit some notes to a branch in one commit,
 * read a file from it, list what changed between two commits, comment on a
 * pull request. Requests go through Obsidian's `requestUrl`, which works on a
 * phone. The token is a fine-grained one for the one repository: Contents
 * (read and write), and Pull requests (read and write) to tell the GM.
 */

import { requestUrl } from "obsidian";

/** A request GitHub refused or never answered: a message for the player, the raw cause apart. */
export class RelayError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
  }
}

export interface Relay {
  head(): Promise<string>;
  commit(files: Record<string, string>, message: string, parent: string): Promise<string>;
  read(path: string, ref?: string): Promise<string | null>;
  changed(base: string, head: string): Promise<Array<{ path: string; removed: boolean }>>;
  comment(pr: number, body: string): Promise<void>;
  /** Whether the token reaches the branch, and may write to the repository (unknown when GitHub does not say). */
  probe(): Promise<{ branch: boolean; write: boolean | undefined }>;
}

const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** `base`: GitHub's API, or another address that speaks it (GitHub Enterprise: `https://host/api/v3`). */
export function githubRelay(repo: string, branch: string, token: string, base = "https://api.github.com"): Relay {
  const api = `${(base || "https://api.github.com").replace(/\/+$/, "")}/repos/${repo}`;
  async function call(method: string, path: string, body?: unknown, accept = "application/vnd.github+json") {
    try {
      return await requestUrl({
        url: `${api}${path}`,
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: accept, "X-GitHub-Api-Version": "2022-11-28" },
        ...(body !== undefined ? { body: JSON.stringify(body), contentType: "application/json" } : {}),
        throw: false,
      });
    } catch (e) {
      // No answer at all: offline, or a network that blocks GitHub.
      throw new RelayError(
        "GitHub could not be reached. Check the connection and try again.",
        0,
        e instanceof Error ? e.message : String(e)
      );
    }
  }
  const fail = (what: string, res: { status: number; text: string }): never => {
    const message =
      res.status === 401
        ? "GitHub did not accept the token. Create a new one in the set-up (step 2) and paste it again."
        : res.status === 403
          ? "The token may not do this: it needs Contents and Pull requests set to read and write on this repository."
          : res.status === 404
            ? "GitHub could not find the repository or the branch, or the token cannot see them."
            : res.status === 409 || res.status === 422
              ? "The branch changed while your turn was being sent. Check for the GM's turn, then hand over again."
              : "GitHub answered with an error. Try again in a moment.";
    throw new RelayError(message, res.status, `${what}: ${res.status} ${res.text.slice(0, 200)}`.trim());
  };

  return {
    async head() {
      const res = await call("GET", `/git/ref/heads/${enc(branch)}`);
      if (res.status >= 400) fail(`Reading the branch ${branch}`, res);
      return res.json.object.sha as string;
    },

    /** One commit holding every file, on top of `parent`. Fails (409/422) when the branch moved on. */
    async commit(files, message, parent) {
      const base = await call("GET", `/git/commits/${parent}`);
      if (base.status >= 400) fail("Reading the branch's last commit", base);
      const tree = await call("POST", "/git/trees", {
        base_tree: base.json.tree.sha,
        tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
      });
      if (tree.status >= 400) fail("Writing the notes", tree);
      const commit = await call("POST", "/git/commits", { message, tree: tree.json.sha, parents: [parent] });
      if (commit.status >= 400) fail("Writing the commit", commit);
      const moved = await call("PATCH", `/git/refs/heads/${enc(branch)}`, { sha: commit.json.sha });
      if (moved.status >= 400) fail("Moving the branch", moved);
      return commit.json.sha as string;
    },

    async read(path, ref = branch) {
      const res = await call(
        "GET",
        `/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`,
        undefined,
        "application/vnd.github.raw+json"
      );
      if (res.status === 404) return null;
      if (res.status >= 400) fail(`Reading ${path}`, res);
      return res.text;
    },

    async changed(base, head) {
      const out: Array<{ path: string; removed: boolean }> = [];
      for (let page = 1; page <= 10; page++) {
        const res = await call("GET", `/compare/${base}...${head}?per_page=100&page=${page}`);
        if (res.status >= 400) fail("Reading what the GM changed", res);
        const files = (res.json.files ?? []) as Array<{ filename: string; status: string }>;
        for (const f of files) out.push({ path: f.filename, removed: f.status === "removed" });
        if (files.length < 100) break;
      }
      return out;
    },

    async probe() {
      const repoRes = await call("GET", "");
      if (repoRes.status >= 400) fail("Reaching the repository", repoRes);
      const branchRes = await call("GET", `/git/ref/heads/${enc(branch)}`);
      const push = (repoRes.json?.permissions as { push?: boolean } | undefined)?.push;
      return { branch: branchRes.status < 400, write: typeof push === "boolean" ? push : undefined };
    },

    async comment(pr, body) {
      const res = await call("POST", `/issues/${pr}/comments`, { body });
      if (res.status >= 400) fail("Telling the GM", res);
    },
  };
}
