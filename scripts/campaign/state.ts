import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Blocker, CampaignConfig, CampaignState } from "./types";

export function getCampaignDirectory(config: CampaignConfig, campaignId: string): string {
  return resolve(config.campaignReportLocation, campaignId);
}

export async function loadCampaignState(
  config: CampaignConfig,
  campaignId: string,
): Promise<CampaignState | null> {
  const dir = getCampaignDirectory(config, campaignId);
  try {
    const raw = await readFile(resolve(dir, "state.json"), "utf-8");
    return JSON.parse(raw) as CampaignState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function saveCampaignState(
  config: CampaignConfig,
  state: CampaignState,
): Promise<void> {
  const dir = getCampaignDirectory(config, state.campaignId);
  await mkdir(dir, { recursive: true });
  const updated: CampaignState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(resolve(dir, "state.json"), JSON.stringify(updated, null, 2), "utf-8");
}

export async function appendCampaignLog(
  config: CampaignConfig,
  campaignId: string,
  message: string,
): Promise<void> {
  const dir = getCampaignDirectory(config, campaignId);
  await mkdir(dir, { recursive: true });
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await writeFile(resolve(dir, "campaign.log"), line, {
    encoding: "utf-8",
    flag: "a",
  });
}

export async function writeReport(
  config: CampaignConfig,
  campaignId: string,
  fileName: string,
  content: string,
): Promise<void> {
  const dir = getCampaignDirectory(config, campaignId);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, fileName), content, "utf-8");
}

export function generateCampaignId(specId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${specId.toLowerCase()}-${timestamp}`;
}

export function createInitialState(
  specId: string,
  startingSha: string,
  riskTier: string,
  implementModel: string,
  reviewModel: string,
): CampaignState {
  const now = new Date().toISOString();
  return {
    campaignId: generateCampaignId(specId),
    specId,
    phase: "idle",
    riskTier: riskTier as CampaignState["riskTier"],
    models: {
      implement: implementModel,
      review: reviewModel,
    },
    startingSha,
    remediationShas: [],
    reviewVerdicts: [],
    remediationCount: 0,
    blockers: [],
    createdAt: now,
    updatedAt: now,
    completedSpecs: [],
  };
}

export function addBlocker(state: CampaignState, type: string, reason: string): CampaignState {
  const blocker: Blocker = { type, reason };
  return {
    ...state,
    blockers: [...state.blockers, blocker],
  };
}
