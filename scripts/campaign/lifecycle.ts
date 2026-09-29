import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ActiveSpec } from "./types";

const SPEC_ID_PATTERN = /^(?:SPEC-)?(\d{3})(?=-|\.|$)/i;

function getCanonicalSpecId(fileName: string): string {
  const match = fileName.match(SPEC_ID_PATTERN);
  return match ? `SPEC-${match[1]}` : fileName.replace(/\.md$/, "");
}

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
  const id = getCanonicalSpecId(fileName);

  const content = await readFile(filePath, "utf-8");
  const titleMatch = content.match(/^#\s*(.+)$/m);
  const title = titleMatch ? cleanTitle(titleMatch[1], id) : undefined;

  return { id, filePath, title };
}

export async function closeSpecLifecycle(spec: ActiveSpec): Promise<{ from: string; to: string }> {
  const root = getSpecsRoot();
  const completedDir = resolve(root, "completed");
  const fromPath = spec.filePath;
  const toPath = resolve(completedDir, baseName(fromPath));

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

function cleanTitle(title: string, id: string): string {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title.trim().replace(new RegExp(`^${escapedId}\\s*(?:[-—]{1,3}|:)?\\s*`, "i"), "");
}

export function updateReadmeLifecycle(readme: string, spec: ActiveSpec): string {
  const completedHeader = "### Completed";
  const escapedId = spec.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const activeStart = readme.indexOf("### Active", readme.indexOf("## Current state"));
  const activeEnd = readme.indexOf("###", activeStart + "### Active".length);
  const activeSection =
    activeStart < 0 ? "" : readme.slice(activeStart, activeEnd < 0 ? undefined : activeEnd);
  const itemPattern = new RegExp(
    `(- \\*\\*${escapedId}(?:\\s+[-—]{1,3}[^*]*)?\\*\\*[^\\n]*\\n(?:[ \\t]+[^\\n]*(?:\\n|$))*)`,
  );
  const activeItem = activeSection.match(itemPattern)?.[1];
  let completedEntry = activeItem
    ? activeItem
        .replace(/`active\/[^`]+`/, `\`completed/${baseName(spec.filePath)}\``)
        .replace(/State: [^\n]*/, "State: COMPLETED — COHERENCE VERIFIED.")
        .trimEnd()
    : `- **${spec.id}${spec.title ? ` — ${spec.title}` : ""}**\n  - \`completed/${baseName(spec.filePath)}\`\n  - State: COMPLETED — COHERENCE VERIFIED.`;

  if (activeItem && activeStart >= 0) {
    const cleanedActive = activeSection.replace(activeItem, "");
    readme =
      readme.slice(0, activeStart) + cleanedActive + (activeEnd < 0 ? "" : readme.slice(activeEnd));
  }

  const currentStateStart = readme.indexOf("## Current state");
  const completedIdx = readme.indexOf(
    completedHeader,
    currentStateStart < 0 ? 0 : currentStateStart,
  );
  if (completedIdx < 0) {
    readme = `${readme}\n${completedHeader}\n\n${completedEntry}\n`;
  } else {
    const insertAt = completedIdx + completedHeader.length;
    completedEntry = completedEntry.trim();
    readme = `${readme.slice(0, insertAt)}\n\n${completedEntry}${readme.slice(insertAt)}`;
  }
  return updateCurrentStateSentence(readme, spec.id);
}

function updateCurrentStateSentence(readme: string, completedSpecId: string): string {
  const escapedId = completedSpecId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sentencePattern = new RegExp(
    `${escapedId} is (?:the next planned roadmap item|(?:currently )?active)(?=[.;])`,
    "g",
  );
  return readme.replace(sentencePattern, `${completedSpecId} is completed`);
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
  const id = getCanonicalSpecId(fileName);

  const content = await readFile(filePath, "utf-8");
  const titleMatch = content.match(/^#\s*(.+)$/m);
  const title = titleMatch ? cleanTitle(titleMatch[1], id) : undefined;

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
