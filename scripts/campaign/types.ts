export type RiskTier = "ECONOMY" | "STANDARD" | "HIGH_RISK";

export type SpecStatus = "planned" | "active" | "implemented_review_required" | "completed";

export type CampaignPhase =
  | "idle"
  | "preconditions"
  | "implementing"
  | "reviewing"
  | "remediating"
  | "closing"
  | "completed"
  | "blocked"
  | "failed"
  | "human_review_required";

export type ImplementationStatus = "IMPLEMENTED" | "PARTIALLY_IMPLEMENTED" | "BLOCKED" | "FAILED";

export type ReviewVerdict =
  "PASS" | "PASS_WITH_FOLLOWUPS" | "FIX_REQUIRED" | "REJECT" | "REVIEW_INCOMPLETE";

export type FindingClassification =
  "MERGE_BLOCKER" | "FIX_BEFORE_ACCEPTANCE" | "SAFE_FOLLOWUP" | "INFORMATIONAL";

export type RemediationStatus = "REMEDIATED" | "BLOCKED" | "FAILED";

export interface CampaignConfig {
  models: {
    economy: string;
    standard: string;
    highRisk: string;
    review: string;
    reviewEscalation: string;
  };
  maxRemediationRounds: number;
  requireIndependentReview: boolean;
  allowAutoCommits: boolean;
  autoApproveOpenCodePermissions: boolean;
  openCodeTimeoutSeconds: number;
  campaignReportLocation: string;
}

export interface Finding {
  classification: FindingClassification;
  id: string;
  summary: string;
  affectedArea?: string;
}

export interface Blocker {
  type: string;
  reason: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
}

export interface ImplementationResult {
  schema: "pfy-campaign-result/v1";
  operation: "implement";
  specId: string;
  status: ImplementationStatus;
  startingSha: string;
  endingSha: string;
  commits: CommitInfo[];
  testsRun: string[];
  checksNotRun: string[];
  blockers: Blocker[];
  riskNotes: string[];
  summary: string;
}

export interface ReviewResult {
  schema: "pfy-campaign-result/v1";
  operation: "review";
  specId: string;
  verdict: ReviewVerdict;
  baseSha: string;
  headSha: string;
  findings: Finding[];
  blockers: Blocker[];
  summary: string;
}

export interface RemediationResult {
  schema: "pfy-campaign-result/v1";
  operation: "remediate";
  specId: string;
  status: RemediationStatus;
  startingSha: string;
  endingSha: string;
  findingsAddressed: { findingId: string; summary: string }[];
  findingsDisputed: { findingId: string; reason: string }[];
  commits: CommitInfo[];
  testsRun: string[];
  blockers: Blocker[];
  summary: string;
}

export type AgentResult = ImplementationResult | ReviewResult | RemediationResult;

export interface GitState {
  branch: string;
  head: string;
  isClean: boolean;
  changedFiles: string[];
  untrackedFiles: string[];
}

export interface CampaignState {
  campaignId: string;
  specId: string;
  phase: CampaignPhase;
  riskTier: RiskTier;
  models: {
    implement: string;
    review: string;
  };
  startingSha: string;
  implementationSha?: string;
  remediationShas: string[];
  reviewVerdicts: ReviewVerdict[];
  remediationCount: number;
  blockers: Blocker[];
  createdAt: string;
  updatedAt: string;
  completedSpecs: string[];
  dryRun?: boolean;
}

export interface CampaignOptions {
  dryRun: boolean;
  once: boolean;
  resume: boolean;
  campaignId?: string;
  configPath?: string;
}

export interface ActiveSpec {
  id: string;
  filePath: string;
  title?: string;
}
