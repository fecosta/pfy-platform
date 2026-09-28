import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Finding, ReviewResult } from "./types";

export async function loadPromptTemplate(
  name: "implement" | "review" | "remediate",
  configPath?: string,
): Promise<string> {
  const dirs = configPath
    ? [resolve(configPath, "..", "prompts")]
    : [resolve(".opencode/campaign/prompts"), resolve("opencode-campaign-prompts")];

  for (const dir of dirs) {
    const path = resolve(dir, `${name}.md`);
    try {
      return await readFile(path, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Prompt template not found: ${name}.md`);
}

export function renderPrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

export function formatFindingsForPrompt(findings: Finding[]): string {
  if (findings.length === 0) {
    return "No findings recorded.";
  }

  return findings
    .map(
      (f, idx) =>
        `${idx + 1}. [${f.classification}] ${f.id}: ${f.summary}${
          f.affectedArea ? ` (affected: ${f.affectedArea})` : ""
        }`,
    )
    .join("\n");
}

export function getReviewContext(review: ReviewResult): {
  baseSha: string;
  headSha: string;
  findings: Finding[];
} {
  return {
    baseSha: review.baseSha,
    headSha: review.headSha,
    findings: review.findings,
  };
}
