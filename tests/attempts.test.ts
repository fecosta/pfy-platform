import { describe, expect, it } from "vitest";

import {
  activityPerformance,
  activityProgress,
  latestCompletedAttempt,
} from "@/lib/attempts/derivations";
import type { ExerciseAttempt } from "@/lib/attempts/types";

const attempt = (overrides: Partial<ExerciseAttempt> = {}): ExerciseAttempt => ({
  id: "a1",
  exerciseId: "e1",
  activityId: "activity",
  userId: "user",
  attemptNumber: 1,
  status: "completed",
  startedAt: "2026-01-01T00:00:00Z",
  completedAt: "2026-01-01T00:01:00Z",
  scoreRaw: null,
  scoreMax: null,
  scoreScaled: null,
  isPassed: null,
  durationSeconds: null,
  scoreProvenance: null,
  content: null,
  assessmentModeAtAttempt: "automatic",
  scoringPolicyAtAttempt: "required",
  ...overrides,
});

describe("attempt derivations", () => {
  it("keeps the earlier completed evidence when a later attempt is started", () => {
    const completed = attempt({ scoreScaled: 0.8 });
    expect(
      latestCompletedAttempt(
        [completed, attempt({ id: "a2", attemptNumber: 2, status: "started" })],
        "e1",
      ),
    ).toBe(completed);
  });

  it("selects the later completed attempt and preserves null scores", () => {
    const current = attempt({ id: "a2", attemptNumber: 2 });
    expect(latestCompletedAttempt([attempt({ scoreScaled: 0.2 }), current], "e1")).toBe(current);
    expect(current.scoreScaled).toBeNull();
  });

  it("derives completion independently of score and evaluation", () => {
    expect(activityProgress(["e1", "e2"], [attempt()])).toBe("in_progress");
    expect(activityProgress(["e1"], [attempt({ assessmentModeAtAttempt: "manual" })])).toBe(
      "completed",
    );
    expect(activityProgress(["e1"], [])).toBe("not_started");
  });

  it("uses historical policy and manual evaluation score", () => {
    expect(
      activityPerformance(["e1"], [attempt({ scoringPolicyAtAttempt: "none", scoreScaled: 0 })]),
    ).toBe("no_score");
    const manual = attempt({ assessmentModeAtAttempt: "manual", scoreScaled: 0.1 });
    expect(
      activityPerformance(
        ["e1"],
        [manual],
        [
          {
            id: "v1",
            attemptId: "a1",
            evaluatorUserId: "teacher",
            feedback: "",
            score: 0.8,
            scoreProvenance: "evaluator_reported",
            evaluatedAt: "2026-01-01",
          },
        ],
      ),
    ).toBe("adequate");
  });

  it("applies the low-score proportion thresholds", () => {
    expect(
      activityPerformance(
        ["e1", "e2", "e3"],
        [
          attempt({ scoreScaled: 0.4 }),
          attempt({ id: "a2", exerciseId: "e2", scoreScaled: 0.8 }),
          attempt({ id: "a3", exerciseId: "e3", scoreScaled: 0.8 }),
        ],
      ),
    ).toBe("attention");
    expect(
      activityPerformance(
        ["e1", "e2"],
        [attempt({ scoreScaled: 0.4 }), attempt({ id: "a2", exerciseId: "e2", scoreScaled: 0.3 })],
      ),
    ).toBe("needs_review");
  });
});
