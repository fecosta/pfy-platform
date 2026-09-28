import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ActiveSpec } from "./types";

const SPEC_ID_PATTERN = /^(SPEC-\d+)/i;

function getSpecsRoot(): string {
  return process.env.PFY_CAMPAIGN_SPECS_ROOT
    ? resolve(process.env.PFY_CAMPAIGN_SPECS_ROOT)
    : resolve("resources/specs");
}

export async function discoverActiveSpec(): Promise<ActiveSpec | null> {
  const activeDir = resolve(getSpecsRoot(), "active");
  const entries = await readdir(activeDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "README.md")
    .map((e) => e.name)
    .sort();

  if (mdFiles.length === 0) {
    return null;
  }

  if (mdFiles.length > 1) {
    throw new Error(
      `Multiple active SPECs found: ${mdFiles.join(", ")}. Campaign expects one primary active unit.`,
    );
  }

  const fileName = mdFiles[0];
  const filePath = resolve(activeDir, fileName);
  const match = fileName.match(SPEC_ID_PATTERN);
  const id = match ? match[1].toUpperCase() : fileName.replace(/\.md$/, "");

  const content = await readFile(filePath, "utf-8");
  const titleMatch = content.match(/^#\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  return { id, filePath, title };
}

export async function closeSpecLifecycle(spec: ActiveSpec): Promise<{ from: string; to: string }> {
  const root = getSpecsRoot();
  const completedDir = resolve(root, "completed");
  const fromPath = spec.filePath;
  const toPath = resolve(completedDir, `${spec.id.toLowerCase()}-${baseName(fromPath)}`);

  await rename(fromPath, toPath);

  const readmePath = resolve(getSpecsRoot(), "README.md");
  const readme = await readFile(readmePath, "utf-8");
  const updated = updateReadmeLifecycle(readme, spec);
  await writeFile(readmePath, updated, "utf-8");

  return { from: fromPath, to: toPath };
}

function baseName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

export function updateReadmeLifecycle(readme: string, spec: ActiveSpec): string {
  const completedHeader = "### Completed";

  const activeEntry = `\n- **${spec.id}${spec.title ? ` — ${spec.title}` : ""}**\n  - \`active/${baseName(spec.filePath)}\`\n  - State: ACTIVE — IMPLEMENTED / REVIEW REQUIRED.\n`;

  const completedEntry = `\n- **${spec.id}${spec.title ? ` — ${spec.title}` : ""}**\n  - \`completed/${spec.id.toLowerCase()}-${baseName(spec.filePath)}\`\n  - State: COMPLETED — COHERENCE VERIFIED.\n`;

  let result = readme;

  if (result.includes(activeEntry.trim())) {
    result = result.replace(activeEntry.trim(), completedEntry.trim());
  } else {
    result = moveEntryToCompleted(result, spec, completedEntry, completedHeader);
  }

  result = updateCurrentStateSentence(result, spec.id);
  return result;
}

function moveEntryToCompleted(
  readme: string,
  spec: ActiveSpec,
  completedEntry: string,
  completedHeader: string,
): string {
  const activeStart = readme.indexOf("### Active");
  const activeEnd = readme.indexOf("###", activeStart + "### Active".length);
  const activeSection =
    activeStart === -1
      ? ""
      : readme.slice(activeStart, activeEnd === -1 ? readme.length : activeEnd);

  const bulletPattern = new RegExp(
    `- \\*\\*${spec.id}[^*]*\\*\\*[^\\n]*\\n(?:  - [^\\n]*\\n?)*`,
    "g",
  );
  const cleanedActive = activeSection.replace(bulletPattern, "");

  if (activeStart !== -1 && activeEnd !== -1) {
    readme = readme.slice(0, activeStart) + cleanedActive + readme.slice(activeEnd);
  }

  const completedIdx = readme.indexOf(completedHeader);
  if (completedIdx === -1) {
    return readme + "\n" + completedHeader + "\n" + completedEntry;
  }

  const insertAfter = completedIdx + completedHeader.length;
  return readme.slice(0, insertAfter) + completedEntry + readme.slice(insertAfter);
}

function updateCurrentStateSentence(readme: string, completedSpecId: string): string {
  const sentencePattern = new RegExp(
    `${completedSpecId} is (?:the next planned roadmap item|currently active)\\.`,
    "g",
  );
  return readme.replace(sentencePattern, `${completedSpecId} is completed.`);
}

export async function findNextPlannedSpec(): Promise<ActiveSpec | null> {
  const plannedDir = resolve(getSpecsRoot(), "planned");
  const entries = await readdir(plannedDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "README.md")
    .map((e) => e.name)
    .sort();

  if (mdFiles.length === 0) {
    return null;
  }

  const fileName = mdFiles[0];
  const filePath = resolve(plannedDir, fileName);
  const match = fileName.match(SPEC_ID_PATTERN);
  const id = match ? match[1].toUpperCase() : fileName.replace(/\.md$/, "");

  const content = await readFile(filePath, "utf-8");
  const titleMatch = content.match(/^#\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  return { id, filePath, title };
}

export async function promotePlannedSpecToActive(
  spec: ActiveSpec,
): Promise<{ from: string; to: string }> {
  const root = getSpecsRoot();
  const activeDir = resolve(root, "active");
  const fromPath = spec.filePath;
  const toPath = resolve(activeDir, baseName(fromPath));
  await rename(fromPath, toPath);
  return { from: fromPath, to: toPath };
}
