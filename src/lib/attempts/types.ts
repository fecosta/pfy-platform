export type AssessmentMode = "automatic" | "manual" | "none";
export type ScoringPolicy = "required" | "optional" | "none";

export type AttemptStatus = "started" | "completed";

export type ScoreProvenance = "client_reported" | "evaluator_reported";

export type ExerciseAttempt = {
  id: string;
  exerciseId: string;
  activityId: string;
  userId: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: string;
  completedAt: string | null;
  scoreRaw: number | null;
  scoreMax: number | null;
  scoreScaled: number | null;
  isPassed: boolean | null;
  durationSeconds: number | null;
  scoreProvenance: ScoreProvenance | null;
  content: string | null;
  assessmentModeAtAttempt: AssessmentMode;
  scoringPolicyAtAttempt: ScoringPolicy;
};

export type ExerciseEvaluation = {
  id: string;
  attemptId: string;
  evaluatorUserId: string;
  feedback: string;
  score: number | null;
  scoreProvenance: "evaluator_reported";
  evaluatedAt: string;
};

export type ActivityProgressState = "not_started" | "in_progress" | "completed";
export type ActivityPerformanceState = "no_score" | "adequate" | "attention" | "needs_review";

/** Row shape returned by the `exercise_attempts` table (snake_case, as stored). */
export type ExerciseAttemptRow = {
  id: string;
  exercise_id: string;
  activity_id: string;
  user_id: string;
  attempt_number: number;
  status: AttemptStatus;
  started_at: string;
  completed_at: string | null;
  score_raw: number | null;
  score_max: number | null;
  score_scaled: number | null;
  is_passed: boolean | null;
  duration_seconds: number | null;
  score_provenance: ScoreProvenance | null;
  content: string | null;
  assessment_mode_at_attempt: AssessmentMode;
  scoring_policy_at_attempt: ScoringPolicy;
};

export type ExerciseEvaluationRow = {
  id: string;
  attempt_id: string;
  evaluator_user_id: string;
  feedback: string;
  score: number | null;
  score_provenance: "evaluator_reported";
  evaluated_at: string;
};

export function attemptFromRow(row: ExerciseAttemptRow): ExerciseAttempt {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    activityId: row.activity_id,
    userId: row.user_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    scoreRaw: row.score_raw,
    scoreMax: row.score_max,
    scoreScaled: row.score_scaled,
    isPassed: row.is_passed,
    durationSeconds: row.duration_seconds,
    scoreProvenance: row.score_provenance,
    content: row.content,
    assessmentModeAtAttempt: row.assessment_mode_at_attempt,
    scoringPolicyAtAttempt: row.scoring_policy_at_attempt,
  };
}

export function evaluationFromRow(row: ExerciseEvaluationRow): ExerciseEvaluation {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    evaluatorUserId: row.evaluator_user_id,
    feedback: row.feedback,
    score: row.score,
    scoreProvenance: row.score_provenance,
    evaluatedAt: row.evaluated_at,
  };
}
