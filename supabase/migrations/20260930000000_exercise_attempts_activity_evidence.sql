-- SPEC-006: Exercise Attempts, Activity Progress & Results.
--
-- Adds Exercise-owned assessment configuration (assessment_mode/scoring_policy),
-- append-only Exercise Attempts, and the Evaluation domain model for
-- manual-assessment Exercises. Activity Progress and Activity Performance are
-- deliberately NOT materialized here (Section 15 implementation freedom): they
-- are derived from exercise_attempts/exercise_evaluations in the application
-- layer (src/lib/attempts/), which keeps the aggregation rule unit-testable
-- without a database round-trip.

-- ─── 5.0 Exercise assessment configuration ─────────────────────────────────
-- Never inferred from Attempt evidence (PRODUCT_DEFINITION.md §4.3a). An
-- unattempted Exercise still has known assessment/scoring semantics, so both
-- columns are NOT NULL with explicit defaults rather than nullable.
--
-- Defaults are deliberately conservative: `scoring_policy` defaults to `none`
-- so an Exercise created without explicit configuration does not silently
-- enter the Activity Performance denominator. `assessment_mode` defaults to
-- `automatic` because H5P is the primary MVP Exercise implementation
-- (PRODUCT_DEFINITION.md §4.3). No existing Exercises/Attempts exist in
-- production yet (Section 13a), so no backfill beyond these defaults is
-- required.
alter table public.exercises
  add column assessment_mode text not null default 'automatic'
    check (assessment_mode in ('automatic', 'manual', 'none')),
  add column scoring_policy text not null default 'none'
    check (scoring_policy in ('required', 'optional', 'none'));

grant select (id, activity_id, title, assessment_mode, scoring_policy)
  on public.exercises to authenticated;

-- ─── Identity helper ────────────────────────────────────────────────────────
-- Resolves the caller's canonical PFY user id from the authenticated Supabase
-- session. Used by every Attempt/Evaluation RPC below so that learner
-- identity is always server-resolved from auth.uid(), never accepted as a
-- client-supplied parameter (Section 10).
create or replace function public.pfy_current_pfy_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select users.id
  from public.users
  where users.auth_user_id = (select auth.uid())
$$;

revoke all on function public.pfy_current_pfy_user_id() from public, anon;
grant execute on function public.pfy_current_pfy_user_id() to authenticated;

-- ─── 5.1 Exercise Attempt persistence ───────────────────────────────────────
-- Plain-text canonicalization preserves Unicode, tabs and line breaks while
-- removing non-printing control characters. This is not HTML sanitization.
create or replace function public.pfy_sanitize_attempt_text(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_value, ''), E'\\000', '', 'g'),
        E'[\\001-\\010\\013\\014\\016-\\037\\177]', '', 'g'
      ),
      chr(13) || chr(10), chr(10), 'g'
    ),
    chr(13), chr(10), 'g'
  )
$$;

revoke all on function public.pfy_sanitize_attempt_text(text) from public, anon;
grant execute on function public.pfy_sanitize_attempt_text(text) to authenticated, service_role;

create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null,
  activity_id uuid not null,
  user_id uuid not null references public.users (id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'started' check (status in ('started', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Score fields apply only to `automatic` (H5P) evidence. Manual Evaluation
  -- score lives on exercise_evaluations, never here (Evaluation must never
  -- mutate learner Attempt/submission content — Section 4, Manual Evaluation).
  score_raw numeric,
  score_max numeric check (score_max is null or score_max >= 0),
  score_scaled numeric check (score_scaled is null or (score_scaled >= 0 and score_scaled <= 1)),
  is_passed boolean,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  score_provenance text check (score_provenance is null or score_provenance = 'client_reported'),
  -- Manual-assessment learner submission content. Plain text only: no manual
  -- Exercise content type/authoring UI exists yet (out of scope), so there is
  -- no path that ever renders this as HTML. Size-bounded per Section 10.
  content text check (content is null or char_length(content) <= 20000),
  -- Historical assessment/scoring configuration is stable (Section 4, 5.12a):
  -- snapshot of the Exercise's assessment_mode/scoring_policy at the moment
  -- this Attempt was created. Never updated after insert.
  assessment_mode_at_attempt text not null
    check (assessment_mode_at_attempt in ('automatic', 'manual', 'none')),
  scoring_policy_at_attempt text not null
    check (scoring_policy_at_attempt in ('required', 'optional', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_attempts_completion_shape check (
    (status = 'completed' and completed_at is not null)
    or (status = 'started' and completed_at is null)
  ),
  constraint exercise_attempts_exercise_owner_fk
    foreign key (exercise_id, activity_id)
    references public.exercises (id, activity_id)
    on delete cascade,
  constraint exercise_attempts_unique_number unique (exercise_id, user_id, attempt_number)
);

create index exercise_attempts_latest_idx
  on public.exercise_attempts (exercise_id, user_id, attempt_number desc);
create index exercise_attempts_learner_activity_idx
  on public.exercise_attempts (user_id, activity_id);

create trigger exercise_attempts_set_updated_at
before update on public.exercise_attempts
for each row execute function public.pfy_set_updated_at();

-- Completed evidence is immutable. The controlled completion RPC below is the
-- only authenticated server capability that may transition a started row.
create or replace function public.pfy_reject_completed_attempt_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'completed' then
    raise exception using errcode = '55000', message = 'completed attempts are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger exercise_attempts_completed_immutable
before update or delete on public.exercise_attempts
for each row execute function public.pfy_reject_completed_attempt_mutation();

alter table public.exercise_attempts enable row level security;

revoke all on public.exercise_attempts from anon, authenticated;
-- Learners may read their own Attempt history directly (Section 5.14). All
-- writes go through the SECURITY DEFINER RPCs below — no insert/update grant
-- is given here, so the append-only/server-created invariants (Section 5.2,
-- 5.4) cannot be bypassed by a direct client write.
grant select on public.exercise_attempts to authenticated;

create policy exercise_attempts_owner_select
on public.exercise_attempts
for select
to authenticated
using (user_id = public.pfy_current_pfy_user_id());

-- ─── 10a. Manual Evaluation ─────────────────────────────────────────────────
create table public.exercise_evaluations (
  id uuid primary key default gen_random_uuid(),
  -- One current Evaluation per Attempt for MVP (Section 4, Manual Evaluation;
  -- PRODUCT_DEFINITION.md §10a). Re-review/correction is not defined by MVP.
  attempt_id uuid not null unique references public.exercise_attempts (id) on delete cascade,
  evaluator_user_id uuid not null references public.users (id) on delete restrict,
  feedback text not null default '' check (char_length(feedback) <= 20000),
  score numeric check (score is null or (score >= 0 and score <= 1)),
  -- Fixed value: a manually assigned score must never be stored as
  -- `client_reported` (Section 5.7, Provenance invariant).
  score_provenance text not null default 'evaluator_reported'
    check (score_provenance = 'evaluator_reported'),
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger exercise_evaluations_set_updated_at
before update on public.exercise_evaluations
for each row execute function public.pfy_set_updated_at();

alter table public.exercise_evaluations enable row level security;

revoke all on public.exercise_evaluations from anon, authenticated;
-- Learner read-only access to Evaluations of their OWN Attempts (Section
-- 5.14). No insert/update/delete grant exists for authenticated: writing an
-- Evaluation is possible only through pfy_write_exercise_evaluation below,
-- which is service_role-only and fails closed for ordinary Teacher-initiated
-- access until SPEC-008 (Section 10, Section 11a).
grant select on public.exercise_evaluations to authenticated;

create policy exercise_evaluations_owner_select
on public.exercise_evaluations
for select
to authenticated
using (
  exists (
    select 1 from public.exercise_attempts
    where exercise_attempts.id = exercise_evaluations.attempt_id
      and exercise_attempts.user_id = public.pfy_current_pfy_user_id()
  )
);

-- ─── 5.2/5.3/5.5 Server-created, concurrency-safe Attempt start/resume ─────
-- Callable by an authenticated learner. Resolves identity server-side
-- (auth.uid()), re-checks the same free+published access predicate the
-- content RLS policies enforce (defense in depth: this function is SECURITY
-- DEFINER and therefore does not go through exercises' own RLS), and
-- allocates the next attempt_number under an advisory lock scoped to
-- (exercise, learner) so two concurrent starts cannot collide (Section 5.3).
-- The unique constraint on (exercise_id, user_id, attempt_number) is a
-- second, independent backstop against the same race.
--
-- Resume semantics: if the learner's latest Attempt for this Exercise is
-- still `started` (Section 5.5 — "an Attempt may remain started/
-- incomplete"), that same Attempt is returned instead of allocating a new
-- number. This is what makes reloading the Activity page mid-exercise NOT
-- fabricate a fresh Attempt on every page view; a genuinely new engagement
-- (the prior Attempt already completed) always gets the next number
-- (Section 5.3, append-only — Section 5.4).
create or replace function public.pfy_start_exercise_attempt(p_exercise_id uuid)
returns public.exercise_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := public.pfy_current_pfy_user_id();
  target_activity_id uuid;
  current_assessment_mode text;
  current_scoring_policy text;
  open_attempt public.exercise_attempts;
  next_attempt_number integer;
  result public.exercise_attempts;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select exercises.activity_id, exercises.assessment_mode, exercises.scoring_policy
  into target_activity_id, current_assessment_mode, current_scoring_policy
  from public.exercises
  join public.activities on activities.id = exercises.activity_id
  where exercises.id = p_exercise_id
    and activities.lifecycle = 'published'
    and activities.access_policy = 'free';

  if target_activity_id is null then
    raise exception using errcode = '42501', message = 'exercise is not accessible';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_exercise_id::text || ':' || caller_id::text, 0));

  select * into open_attempt
  from public.exercise_attempts
  where exercise_id = p_exercise_id and user_id = caller_id and status = 'started'
  order by attempt_number desc
  limit 1;

  if open_attempt.id is not null then
    return open_attempt;
  end if;

  select coalesce(max(attempt_number), 0) + 1
  into next_attempt_number
  from public.exercise_attempts
  where exercise_id = p_exercise_id and user_id = caller_id;

  insert into public.exercise_attempts (
    exercise_id, activity_id, user_id, attempt_number,
    assessment_mode_at_attempt, scoring_policy_at_attempt,
    score_provenance
  )
  values (
    p_exercise_id, target_activity_id, caller_id, next_attempt_number,
    current_assessment_mode, current_scoring_policy,
    case when current_assessment_mode = 'automatic' then 'client_reported' else null end
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.pfy_start_exercise_attempt(uuid) from public, anon;
grant execute on function public.pfy_start_exercise_attempt(uuid) to authenticated;

-- ─── 5.6a Manual submission (server-created, concurrency-safe) ─────────────
-- A manual-assessment Exercise "attempt" is created and completed in one
-- step: submission itself is the completion event (Section 4, Manual
-- Evaluation — the Exercise may complete/submit before evaluation exists).
create or replace function public.pfy_submit_manual_exercise_attempt(
  p_exercise_id uuid,
  p_content text
)
returns public.exercise_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := public.pfy_current_pfy_user_id();
  target_activity_id uuid;
  current_assessment_mode text;
  current_scoring_policy text;
  next_attempt_number integer;
  result public.exercise_attempts;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select exercises.activity_id, exercises.assessment_mode, exercises.scoring_policy
  into target_activity_id, current_assessment_mode, current_scoring_policy
  from public.exercises
  join public.activities on activities.id = exercises.activity_id
  where exercises.id = p_exercise_id
    and activities.lifecycle = 'published'
    and activities.access_policy = 'free';

  if target_activity_id is null then
    raise exception using errcode = '42501', message = 'exercise is not accessible';
  end if;

  if current_assessment_mode <> 'manual' then
    raise exception using errcode = '22023', message = 'exercise is not manual-assessment';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_exercise_id::text || ':' || caller_id::text, 0));

  select coalesce(max(attempt_number), 0) + 1
  into next_attempt_number
  from public.exercise_attempts
  where exercise_id = p_exercise_id and user_id = caller_id;

  insert into public.exercise_attempts (
    exercise_id, activity_id, user_id, attempt_number,
    status, completed_at, content,
    assessment_mode_at_attempt, scoring_policy_at_attempt
  )
  values (
    p_exercise_id, target_activity_id, caller_id, next_attempt_number,
    'completed', now(), public.pfy_sanitize_attempt_text(p_content),
    current_assessment_mode, current_scoring_policy
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.pfy_submit_manual_exercise_attempt(uuid, text) from public, anon;
grant execute on function public.pfy_submit_manual_exercise_attempt(uuid, text) to authenticated;

-- ─── 5.6/5.7/5.8/5.5 Apply normalized H5P outcome to an Attempt ────────────
-- Invoked ONLY from the PFY application's server-side H5P Adapter, AFTER it
-- independently verifies the signed runtime token that proves the browser
-- was legitimately issued this (learner, Exercise, Attempt) tuple. The
-- service-role execution here is a technical mechanism, not the
-- authorization decision (Section 10) — the token verification is the
-- authorization, this function only re-checks data-integrity (the attempt
-- actually belongs to the claimed exercise/learner) before writing.
--
-- Idempotent by construction (Section 5.5): once status = 'completed', the
-- row is left untouched and the existing (frozen) row is returned.
create or replace function public.pfy_apply_h5p_attempt_outcome(
  p_attempt_id uuid,
  p_exercise_id uuid,
  p_user_id uuid,
  p_is_completed boolean,
  p_score_raw numeric,
  p_score_max numeric,
  p_score_scaled numeric,
  p_is_passed boolean,
  p_duration_seconds integer
)
returns public.exercise_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.exercise_attempts;
  result public.exercise_attempts;
begin
  select * into current_row
  from public.exercise_attempts
  where id = p_attempt_id;

  if current_row is null
     or current_row.exercise_id <> p_exercise_id
     or current_row.user_id <> p_user_id then
    raise exception using errcode = '42501', message = 'attempt does not match claimed identity';
  end if;

  if current_row.status = 'completed' then
    -- Append-only: never overwrite a completed Attempt (Section 5.4, 5.5).
    return current_row;
  end if;

  if not p_is_completed then
    -- Non-completing evidence (e.g. a progress statement) does not
    -- transition the Attempt; nothing to persist yet.
    return current_row;
  end if;

  update public.exercise_attempts
  set status = 'completed',
      completed_at = now(),
      score_raw = p_score_raw,
      score_max = p_score_max,
      score_scaled = p_score_scaled,
      is_passed = p_is_passed,
      duration_seconds = coalesce(
        p_duration_seconds,
        greatest(0, round(extract(epoch from (now() - current_row.started_at)))::integer)
      )
  where id = p_attempt_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.pfy_apply_h5p_attempt_outcome(
  uuid, uuid, uuid, boolean, numeric, numeric, numeric, boolean, integer
) from public, anon, authenticated;
grant execute on function public.pfy_apply_h5p_attempt_outcome(
  uuid, uuid, uuid, boolean, numeric, numeric, numeric, boolean, integer
) to service_role;

-- ─── 10a/11a Evaluation persistence (fail-closed pending SPEC-008) ─────────
-- SPEC-006 establishes the Evaluation domain model and this protected
-- persistence capability ONLY. It grants no general Teacher evaluation
-- permission (Section 10, Section 11a): this function is reachable
-- exclusively via service_role. This capability remains unavailable to
-- ordinary authenticated callers until SPEC-008 establishes relationship-
-- scoped Teacher authorization. Service-role execution is only a persistence
-- mechanism, not proof that the caller is authorized. `p_evaluator_user_id`
-- must be supplied by trusted server-side policy context, never client input.
create or replace function public.pfy_write_exercise_evaluation(
  p_attempt_id uuid,
  p_evaluator_user_id uuid,
  p_score numeric,
  p_feedback text
)
returns public.exercise_evaluations
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt public.exercise_attempts;
  result public.exercise_evaluations;
begin
  select * into target_attempt from public.exercise_attempts where id = p_attempt_id;
  if target_attempt is null then
    raise exception using errcode = '42704', message = 'unknown attempt';
  end if;
  if target_attempt.assessment_mode_at_attempt <> 'manual' then
    raise exception using errcode = '22023', message = 'attempt is not manual-assessment';
  end if;
  if p_score is not null and target_attempt.scoring_policy_at_attempt = 'none' then
    raise exception using errcode = '22023', message = 'exercise does not accept a score';
  end if;
  if p_score is null and target_attempt.scoring_policy_at_attempt = 'required' then
    raise exception using errcode = '22023', message = 'exercise requires a score';
  end if;

  -- Re-review/correction is not defined by MVP (Section 4, Manual Evaluation;
  -- PRODUCT_DEFINITION.md §10a): an Attempt already carrying a current
  -- Evaluation cannot be silently overwritten by this function. The unique
  -- constraint on exercise_evaluations.attempt_id enforces this at the
  -- database layer too.
  insert into public.exercise_evaluations (attempt_id, evaluator_user_id, score, feedback)
  values (
    p_attempt_id,
    p_evaluator_user_id,
    p_score,
    public.pfy_sanitize_attempt_text(p_feedback)
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.pfy_write_exercise_evaluation(uuid, uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function public.pfy_write_exercise_evaluation(uuid, uuid, numeric, text)
  to service_role;
