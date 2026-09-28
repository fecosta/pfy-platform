import { spawn } from "node:child_process";
import type { CampaignConfig } from "./types";

export interface OpenCodeRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  model: string;
  startedAt: Date;
  endedAt: Date;
}

export interface OpenCodeAdapter {
  run(model: string, prompt: string): Promise<OpenCodeRunResult>;
}

export function createOpenCodeAdapter(config: CampaignConfig): OpenCodeAdapter {
  return {
    async run(model: string, prompt: string): Promise<OpenCodeRunResult> {
      const args = ["run", "-m", model];

      if (config.autoApproveOpenCodePermissions) {
        args.push("--auto");
      }

      args.push(prompt);

      const startedAt = new Date();
      return new Promise((resolve, reject) => {
        const child = spawn("opencode", args, {
          cwd: process.cwd(),
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.setEncoding("utf-8");
        child.stderr.setEncoding("utf-8");
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });

        const timeoutMs = config.openCodeTimeoutSeconds * 1000;
        const timer = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error(`OpenCode timed out after ${config.openCodeTimeoutSeconds}s`));
        }, timeoutMs);

        child.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });

        child.on("close", (exitCode) => {
          clearTimeout(timer);
          const endedAt = new Date();
          resolve({
            stdout,
            stderr,
            exitCode: exitCode ?? -1,
            model,
            startedAt,
            endedAt,
          });
        });
      });
    },
  };
}

export function createMockOpenCodeAdapter(
  responses: Record<string, OpenCodeRunResult>,
): OpenCodeAdapter {
  return {
    async run(model: string, prompt: string): Promise<OpenCodeRunResult> {
      const key = Object.keys(responses).find((k) => prompt.includes(k));
      const response = key ? responses[key] : responses.default;
      if (!response) {
        throw new Error(`No mock response for prompt: ${prompt.slice(0, 80)}`);
      }
      return {
        ...response,
        model,
        startedAt: new Date(),
        endedAt: new Date(),
      };
    },
  };
}
