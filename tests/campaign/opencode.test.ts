import { describe, expect, test, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createOpenCodeAdapter } from "../../scripts/campaign/opencode";
import type { CampaignConfig } from "../../scripts/campaign/types";

/**
 * Minimal fake ChildProcess: real streams (so setEncoding/on("data") work) plus
 * an EventEmitter for process lifecycle events. Tests control timing explicitly
 * by calling emitClose()/kill assertions rather than relying on a real subprocess.
 */
function makeFakeChild() {
  const emitter = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: ReturnType<typeof vi.fn>;
  };
  emitter.stdout = new PassThrough();
  emitter.stderr = new PassThrough();
  const killedSignals: string[] = [];
  emitter.kill = vi.fn((signal?: string) => {
    killedSignals.push(signal ?? "SIGTERM");
    return true;
  });
  return { emitter, killedSignals };
}

const baseConfig: CampaignConfig = {
  models: {
    economy: "economy-model",
    standard: "standard-model",
    highRisk: "highrisk-model",
    review: "review-model",
    reviewEscalation: "escalation-model",
  },
  maxRemediationRounds: 2,
  requireIndependentReview: true,
  allowAutoCommits: false,
  autoApproveOpenCodePermissions: true,
  openCodeTimeoutSeconds: 1, // 1s fake timeout window, exercised via fake timers
  campaignReportLocation: "",
};

describe("createOpenCodeAdapter", () => {
  test("normal execution resolves with stdout/stderr/exitCode and timedOut=false", async () => {
    const { emitter } = makeFakeChild();
    const spawnFn = vi.fn(() => emitter as never);
    const adapter = createOpenCodeAdapter(baseConfig, { spawnFn });

    const runPromise = adapter.run("model-x", "prompt");
    emitter.stdout.write("hello ");
    emitter.stdout.write("world");
    emitter.stderr.write("warn");
    emitter.emit("close", 0, null);

    const result = await runPromise;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello world");
    expect(result.stderr).toBe("warn");
    expect(result.timedOut).toBe(false);
    expect(result.terminationSignal).toBeUndefined();
    expect(result.model).toBe("model-x");
  });

  test("ordinary non-zero exit resolves (not rejects) with exitCode set, timedOut=false", async () => {
    const { emitter } = makeFakeChild();
    const spawnFn = vi.fn(() => emitter as never);
    const adapter = createOpenCodeAdapter(baseConfig, { spawnFn });

    const runPromise = adapter.run("model-x", "prompt");
    emitter.stderr.write("boom");
    emitter.emit("close", 1, null);

    const result = await runPromise;
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("boom");
    expect(result.timedOut).toBe(false);
  });

  test("timeout preserves accumulated stdout/stderr and returns structured timeout metadata", async () => {
    vi.useFakeTimers();
    try {
      const { emitter, killedSignals } = makeFakeChild();
      const spawnFn = vi.fn(() => emitter as never);
      const config = { ...baseConfig, openCodeTimeoutSeconds: 1 };
      const adapter = createOpenCodeAdapter(config, { spawnFn, killGraceMs: 500 });

      const runPromise = adapter.run("model-x", "prompt");
      emitter.stdout.write("partial output before timeout");
      emitter.stderr.write("partial stderr before timeout");

      // Advance past the configured timeout: SIGTERM should fire.
      await vi.advanceTimersByTimeAsync(1000);
      expect(killedSignals).toEqual(["SIGTERM"]);

      // Simulate the child not exiting after SIGTERM; grace period elapses -> SIGKILL.
      await vi.advanceTimersByTimeAsync(500);
      expect(killedSignals).toEqual(["SIGTERM", "SIGKILL"]);

      // Child finally closes after being killed.
      emitter.emit("close", null, "SIGKILL");

      const result = await runPromise;
      expect(result.timedOut).toBe(true);
      expect(result.terminationSignal).toBe("SIGKILL");
      expect(result.stdout).toBe("partial output before timeout");
      expect(result.stderr).toBe("partial stderr before timeout");
      expect(result.exitCode).toBe(-1);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.endedAt).toBeInstanceOf(Date);
    } finally {
      vi.useRealTimers();
    }
  });

  test("process exiting promptly after SIGTERM does not escalate to SIGKILL", async () => {
    vi.useFakeTimers();
    try {
      const { emitter, killedSignals } = makeFakeChild();
      const spawnFn = vi.fn(() => emitter as never);
      const config = { ...baseConfig, openCodeTimeoutSeconds: 1 };
      const adapter = createOpenCodeAdapter(config, { spawnFn, killGraceMs: 500 });

      const runPromise = adapter.run("model-x", "prompt");
      await vi.advanceTimersByTimeAsync(1000);
      expect(killedSignals).toEqual(["SIGTERM"]);

      // Child exits cleanly right after SIGTERM, before the grace period elapses.
      emitter.emit("close", null, "SIGTERM");
      await vi.advanceTimersByTimeAsync(500);

      // No SIGKILL should have been sent since the process already settled.
      expect(killedSignals).toEqual(["SIGTERM"]);

      const result = await runPromise;
      expect(result.timedOut).toBe(true);
      expect(result.terminationSignal).toBe("SIGTERM");
    } finally {
      vi.useRealTimers();
    }
  });

  test("adapter Promise settles exactly once even with duplicate close/error events", async () => {
    const { emitter } = makeFakeChild();
    const spawnFn = vi.fn(() => emitter as never);
    const adapter = createOpenCodeAdapter(baseConfig, { spawnFn });

    const runPromise = adapter.run("model-x", "prompt");
    emitter.emit("close", 0, null);
    // Duplicate events after settlement must be no-ops, not cause unhandled rejections
    // or a second resolve/reject (which would be a no-op for an already-settled Promise
    // but would indicate a listener leak if it threw).
    emitter.emit("close", 1, null);
    emitter.emit("error", new Error("late error after close"));

    const result = await runPromise;
    expect(result.exitCode).toBe(0);
  });

  test("child process spawn error rejects the Promise", async () => {
    const { emitter } = makeFakeChild();
    const spawnFn = vi.fn(() => emitter as never);
    const adapter = createOpenCodeAdapter(baseConfig, { spawnFn });

    const runPromise = adapter.run("model-x", "prompt");
    emitter.emit("error", new Error("ENOENT: opencode not found"));

    await expect(runPromise).rejects.toThrow("ENOENT: opencode not found");
  });
});
