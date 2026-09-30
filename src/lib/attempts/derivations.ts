import type {
  ActivityPerformanceState,
  ActivityProgressState,
  ExerciseAttempt,
  ExerciseEvaluation,
} from "./types";

export function latestCompletedAttempt(
  attempts: ExerciseAttempt[],
  exerciseId: string,
): ExerciseAttempt | null {
  return (
    attempts
      .filter((attempt) => attempt.exerciseId === exerciseId && attempt.status === "completed")
      .sort((a, b) => b.attemptNumber - a.attemptNumber)[0] ?? null
  );
}

export function activityProgress(
  exerciseIds: string[],
  attempts: ExerciseAttempt[],
): ActivityProgressState {
  const attempted = new Set(attempts.map((attempt) => attempt.exerciseId));
  if (attempted.size === 0) return "not_started";
  if (exerciseIds.every((exerciseId) => latestCompletedAttempt(attempts, exerciseId))) {
    return "completed";
  }
  return "in_progress";
}

export function activityPerformance(
  exerciseIds: string[],
  attempts: ExerciseAttempt[],
  evaluations: ExerciseEvaluation[] = [],
): ActivityPerformanceState {
  const scores: number[] = [];

  for (const exerciseId of exerciseIds) {
    const attempt = latestCompletedAttempt(attempts, exerciseId);
    if (!attempt || attempt.scoringPolicyAtAttempt === "none") continue;

    const score =
      attempt.assessmentModeAtAttempt === "manual"
        ? evaluations.find((evaluation) => evaluation.attemptId === attempt.id)?.score
        : attempt.scoreScaled;
    if (score !== null && score !== undefined && score >= 0 && score <= 1) scores.push(score);
  }

  if (scores.length === 0) return "no_score";
  const lowScores = scores.filter((score) => score < 0.5).length;
  const proportion = lowScores / scores.length;
  if (proportion >= 0.5) return "needs_review";
  if (proportion > 0) return "attention";
  return "adequate";
}
