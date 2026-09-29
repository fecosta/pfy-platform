import { spawn } from "node:child_process";
import type { CampaignConfig } from "./types";

/** Bounded grace period between SIGTERM and SIGKILL during timeout termination. */
const DEFAULT_KILL_GRACE_MS = 5000;

export interface OpenCodeRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  model: string;
  startedAt: Date;
  endedAt: Date;
  /** True when the configured timeout was reached and the subprocess was force-terminated. */
  timedOut: boolean;
  /** The final signal used to terminate the process, if any (e.g. "SIGTERM", "SIGKILL"). */
  terminationSignal?: string;
}

export interface OpenCodeAdapter {
  run(model: string, prompt: string): Promise<OpenCodeRunResult>;
}

export interface OpenCodeAdapterOptions {
  /** Bounded grace period between SIGTERM and SIGKILL. Defaults to DEFAULT_KILL_GRACE_MS. */
  killGraceMs?: number;
  /** Injectable spawn implementation for tests. Defaults to node:child_process spawn. */
  spawnFn?: typeof spawn;
}

export function createOpenCodeAdapter(
  config: CampaignConfig,
  options: OpenCodeAdapterOptions = {},
): OpenCodeAdapter {
  const killGraceMs = options.killGraceMs ?? DEFAULT_KILL_GRACE_MS;
  const spawnFn = options.spawnFn ?? spawn;

  return {
    async run(model: string, prompt: string): Promise<OpenCodeRunResult> {
      const args = ["run", "-m", model];

      if (config.autoApproveOpenCodePermissions) {
        args.push("--auto");
      }

      args.push(prompt);

      const startedAt = new Date();
      return new Promise((resolve, reject) => {
        const child = spawnFn("opencode", args, {
          cwd: process.cwd(),
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
        });

        let stdout = "";
        let stderr = "";
        let settled = false;
        let timedOut = false;
        let terminationSignal: string | undefined;
        let killTimer: NodeJS.Timeout | undefined;

        child.stdout.setEncoding("utf-8");
        child.stderr.setEncoding("utf-8");
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });

        const timeoutMs = config.openCodeTimeoutSeconds * 1000;
        const timeoutTimer = setTimeout(() => {
          timedOut = true;
          terminationSignal = "SIGTERM";
          child.kill("SIGTERM");
          killTimer = setTimeout(() => {
            if (!settled) {
              terminationSignal = "SIGKILL";
              child.kill("SIGKILL");
            }
          }, killGraceMs);
        }, timeoutMs);

        const cleanup = () => {
          clearTimeout(timeoutTimer);
          if (killTimer) clearTimeout(killTimer);
        };

        child.on("error", (err) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        });

        child.on("close", (exitCode, signal) => {
          if (settled) return;
          settled = true;
          cleanup();
          const endedAt = new Date();
          resolve({
            stdout,
            stderr,
            exitCode: exitCode ?? -1,
            model,
            startedAt,
            endedAt,
            timedOut,
            terminationSignal: terminationSignal ?? signal ?? undefined,
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
