import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitState } from "./types";

const execFileAsync = promisify(execFile);

export interface GitAdapter {
  getGitState(): Promise<GitState>;
  verifyHead(expectedSha: string): Promise<void>;
  isAncestor(ancestorSha: string, descendantSha: string): Promise<boolean>;
}

export function createGitAdapter(): GitAdapter {
  return {
    getGitState,
    verifyHead,
    isAncestor,
  };
}

async function getGitState(): Promise<GitState> {
  const [branch, head, status] = await Promise.all([
    execGit(["branch", "--show-current"]),
    execGit(["rev-parse", "HEAD"]),
    execGit(["status", "--porcelain=v1"]),
  ]);

  const lines = status.split("\n").filter(Boolean);
  const changedFiles: string[] = [];
  const untrackedFiles: string[] = [];

  for (const line of lines) {
    const statusCode = line.slice(0, 2);
    const file = line.slice(3);
    if (statusCode === "??") {
      untrackedFiles.push(file);
    } else {
      changedFiles.push(file);
    }
  }

  return {
    branch: branch.trim(),
    head: head.trim(),
    isClean: lines.length === 0,
    changedFiles,
    untrackedFiles,
  };
}

export async function verifyHead(expectedSha: string): Promise<void> {
  const actual = await execGit(["rev-parse", "HEAD"]);
  const actualSha = actual.trim();
  if (actualSha !== expectedSha) {
    throw new Error(`Git integrity mismatch: expected HEAD ${expectedSha}, found ${actualSha}`);
  }
}

export async function isAncestor(ancestorSha: string, descendantSha: string): Promise<boolean> {
  try {
    await execGit(["merge-base", "--is-ancestor", ancestorSha, descendantSha]);
    return true;
  } catch {
    return false;
  }
}

async function execGit(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

export async function getDiffStats(
  baseSha: string,
  headSha: string,
): Promise<{ files: string[]; insertions: number; deletions: number }> {
  const out = await execGit(["diff", "--stat", `${baseSha}..${headSha}`]).catch(() => "");

  const files: string[] = [];
  let insertions = 0;
  let deletions = 0;

  for (const line of out.split("\n")) {
    const match = line.match(/^(.*?)\s*\|\s*(\d+)\s*([+-]*)/);
    if (match) {
      const file = match[1].trim();
      const count = Number.parseInt(match[2], 10);
      const signs = match[3] ?? "";
      files.push(file);
      const plusCount = (signs.match(/\+/g) ?? []).length;
      const minusCount = (signs.match(/-/g) ?? []).length;
      insertions += plusCount > 0 ? count : 0;
      deletions += minusCount > 0 ? count : 0;
    }
  }

  return { files, insertions, deletions };
}
