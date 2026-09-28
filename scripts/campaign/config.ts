import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { CampaignConfig, RiskTier } from "./types";

const configSchema = z.object({
  models: z.object({
    economy: z.string().min(1),
    standard: z.string().min(1),
    highRisk: z.string().min(1),
    review: z.string().min(1),
    reviewEscalation: z.string().min(1),
  }),
  maxRemediationRounds: z.number().int().min(0).default(2),
  requireIndependentReview: z.boolean().default(true),
  allowAutoCommits: z.boolean().default(false),
  autoApproveOpenCodePermissions: z.boolean().default(true),
  openCodeTimeoutSeconds: z.number().int().min(1).default(1800),
  campaignReportLocation: z.string().min(1).default("resources/campaigns"),
});

const defaultConfig: CampaignConfig = {
  models: {
    economy: "9router/ocg/kimi-k2.7-code",
    standard: "9router/ocg/kimi-k2.7-code",
    highRisk: "9router/cc/claude-sonnet-5",
    review: "9router/cx/gpt-5.6-luna-review",
    reviewEscalation: "9router/cx/gpt-5.6-sol-review",
  },
  maxRemediationRounds: 2,
  requireIndependentReview: true,
  allowAutoCommits: false,
  autoApproveOpenCodePermissions: true,
  openCodeTimeoutSeconds: 1800,
  campaignReportLocation: "resources/campaigns",
};

export async function loadConfig(configPath?: string): Promise<CampaignConfig> {
  const paths = configPath
    ? [resolve(configPath)]
    : [resolve(".opencode/campaign/config.json"), resolve("opencode-campaign.config.json")];

  for (const path of paths) {
    try {
      const raw = await readFile(path, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      const merged = { ...defaultConfig, ...(parsed as object) };
      const validated = configSchema.parse(merged);
      return validated;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw new Error(
        `Invalid campaign config at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return defaultConfig;
}

export function selectImplementationModel(config: CampaignConfig, riskTier: RiskTier): string {
  switch (riskTier) {
    case "HIGH_RISK":
      return config.models.highRisk;
    case "STANDARD":
      return config.models.standard;
    case "ECONOMY":
    default:
      return config.models.economy;
  }
}

export function selectReviewModel(config: CampaignConfig): string {
  return config.models.review;
}

export function selectEscalationModel(config: CampaignConfig): string {
  return config.models.reviewEscalation;
}
