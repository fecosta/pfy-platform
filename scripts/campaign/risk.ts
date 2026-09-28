import { readFile } from "node:fs/promises";
import type { ActiveSpec, RiskTier } from "./types";

interface RiskClassification {
  tier: RiskTier;
  reason: string;
}

const highRiskKeywords = [
  "authentication",
  "authorization",
  "rls",
  "row level security",
  "permission",
  "billing",
  "license",
  "licensing",
  "entitlement",
  "institutional privacy",
  "privacy layer",
  "migration",
  "destructive",
  "h5p",
  "library installation",
  "untrusted content",
  "import pipeline",
  "legacy user",
  "legacy data",
  "sensitive",
];

const standardRiskKeywords = [
  "teacher",
  "student",
  "relationship",
  "organization",
  "attempt",
  "progress",
  "performance",
  "authoring",
  "content workflow",
  "percurso",
  "syllabus",
];

export async function classifyRisk(spec: ActiveSpec): Promise<RiskClassification> {
  const fileNameLower = spec.filePath.toLowerCase();

  if (
    fileNameLower.includes("auth") ||
    fileNameLower.includes("ident") ||
    fileNameLower.includes("h5p-runtime") ||
    fileNameLower.includes("billing") ||
    fileNameLower.includes("licens") ||
    fileNameLower.includes("migration")
  ) {
    return {
      tier: "HIGH_RISK",
      reason: `Explicit high-risk filename indicator in ${spec.filePath}`,
    };
  }

  const content = await readFile(spec.filePath, "utf-8").catch(() => "");
  const contentLower = content.toLowerCase();

  const matchedHigh = highRiskKeywords.filter((kw) => contentLower.includes(kw));
  if (matchedHigh.length >= 2) {
    return {
      tier: "HIGH_RISK",
      reason: `High-risk keywords matched: ${matchedHigh.slice(0, 5).join(", ")}`,
    };
  }

  const matchedStandard = standardRiskKeywords.filter((kw) => contentLower.includes(kw));
  if (matchedStandard.length >= 2) {
    return {
      tier: "STANDARD",
      reason: `Standard-risk keywords matched: ${matchedStandard.slice(0, 5).join(", ")}`,
    };
  }

  return {
    tier: "ECONOMY",
    reason: "No elevated risk indicators; default economy tier",
  };
}

export function classifyRiskExplicit(tier: string): RiskTier {
  if (tier === "HIGH_RISK" || tier === "STANDARD" || tier === "ECONOMY") {
    return tier;
  }
  return "ECONOMY";
}
