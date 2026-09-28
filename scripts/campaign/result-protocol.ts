import { z } from "zod";
import type {
  AgentResult,
  Blocker,
  Finding,
  ImplementationResult,
  RemediationResult,
  ReviewResult,
} from "./types";

const blockerSchema = z.object({
  type: z.string(),
  reason: z.string(),
});

const commitSchema = z.object({
  sha: z.string(),
  message: z.string(),
});

const findingSchema = z.object({
  classification: z.enum([
    "MERGE_BLOCKER",
    "FIX_BEFORE_ACCEPTANCE",
    "SAFE_FOLLOWUP",
    "INFORMATIONAL",
  ]),
  id: z.string(),
  summary: z.string(),
  affectedArea: z.string().optional(),
});

const implementationSchema = z.object({
  schema: z.literal("pfy-campaign-result/v1"),
  operation: z.literal("implement"),
  specId: z.string(),
  status: z.enum(["IMPLEMENTED", "PARTIALLY_IMPLEMENTED", "BLOCKED", "FAILED"]),
  startingSha: z.string(),
  endingSha: z.string(),
  commits: z.array(commitSchema).default([]),
  testsRun: z.array(z.string()).default([]),
  checksNotRun: z.array(z.string()).default([]),
  blockers: z.array(blockerSchema).default([]),
  riskNotes: z.array(z.string()).default([]),
  summary: z.string(),
});

const reviewSchema = z.object({
  schema: z.literal("pfy-campaign-result/v1"),
  operation: z.literal("review"),
  specId: z.string(),
  verdict: z.enum(["PASS", "PASS_WITH_FOLLOWUPS", "FIX_REQUIRED", "REJECT", "REVIEW_INCOMPLETE"]),
  baseSha: z.string(),
  headSha: z.string(),
  findings: z.array(findingSchema).default([]),
  blockers: z.array(blockerSchema).default([]),
  summary: z.string(),
});

const remediationSchema = z.object({
  schema: z.literal("pfy-campaign-result/v1"),
  operation: z.literal("remediate"),
  specId: z.string(),
  status: z.enum(["REMEDIATED", "BLOCKED", "FAILED"]),
  startingSha: z.string(),
  endingSha: z.string(),
  findingsAddressed: z.array(z.object({ findingId: z.string(), summary: z.string() })).default([]),
  findingsDisputed: z.array(z.object({ findingId: z.string(), reason: z.string() })).default([]),
  commits: z.array(commitSchema).default([]),
  testsRun: z.array(z.string()).default([]),
  blockers: z.array(blockerSchema).default([]),
  summary: z.string(),
});

export function parseAgentResult(rawOutput: string): AgentResult {
  const startMarker = "---PFY_CAMPAIGN_RESULT---";
  const endMarker = "---END_PFY_CAMPAIGN_RESULT---";

  const startIdx = rawOutput.indexOf(startMarker);
  const endIdx = rawOutput.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      `Malformed agent result: delimiters not found or misordered in output of length ${rawOutput.length}`,
    );
  }

  const jsonText = rawOutput.slice(startIdx + startMarker.length, endIdx).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(
      `Malformed agent result JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const base = z.object({ operation: z.enum(["implement", "review", "remediate"]) }).parse(parsed);

  if (base.operation === "implement") {
    return implementationSchema.parse(parsed) as ImplementationResult;
  }

  if (base.operation === "review") {
    return reviewSchema.parse(parsed) as ReviewResult;
  }

  return remediationSchema.parse(parsed) as RemediationResult;
}

export function extractDecisionRequiredBlockers(result: AgentResult): Blocker[] {
  const all = "blockers" in result ? result.blockers : [];
  return all.filter(
    (b) =>
      b.type === "DECISION REQUIRED" ||
      b.reason.includes("DECISION REQUIRED") ||
      b.reason.includes("BLOCKED / DECISION REQUIRED"),
  );
}

export function hasBlockingFindings(findings: Finding[]): boolean {
  return findings.some(
    (f) => f.classification === "MERGE_BLOCKER" || f.classification === "FIX_BEFORE_ACCEPTANCE",
  );
}

export function isAcceptableForClosure(review: ReviewResult): boolean {
  if (review.verdict === "REVIEW_INCOMPLETE") return false;
  if (review.verdict === "FIX_REQUIRED" || review.verdict === "REJECT") return false;
  return !hasBlockingFindings(review.findings);
}
