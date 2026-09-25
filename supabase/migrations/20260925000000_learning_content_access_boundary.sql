-- SPEC-004 reconciliation: publication, catalog discovery and content access are distinct.

alter table public.activities
  add column access_policy text not null default 'entitlement_required'
    check (access_policy in ('free', 'entitlement_required'));

create or replace function public.pfy_has_authenticated_identity()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where users.auth_user_id = (select auth.uid())
  );
$$;

revoke all on function public.pfy_has_authenticated_identity() from public, anon;
grant execute on function public.pfy_has_authenticated_identity() to authenticated;

-- These views are the only ordinary catalog surface. Arbitrary JSONB and lifecycle
-- fields are intentionally excluded from the anonymous projection.
create or replace view public.published_activity_catalog
with (security_barrier = true)
as
select
  id,
  title,
  summary,
  cover_asset_url,
  level,
  access_policy
from public.activities
where lifecycle = 'published';

create or replace view public.published_syllabus_catalog
with (security_barrier = true)
as
select
  syllabi.id as syllabus_id,
  syllabi.title as syllabus_title,
  syllabi.description as syllabus_description,
  syllabi.level as syllabus_level,
  syllabi.expected_workload,
  syllabus_activities.position,
  activities.id as activity_id,
  activities.title as activity_title,
  activities.summary as activity_summary,
  activities.cover_asset_url as activity_cover_asset_url,
  activities.level as activity_level,
  activities.access_policy
from public.syllabi
join public.syllabus_activities on syllabus_activities.syllabus_id = syllabi.id
join public.activities on activities.id = syllabus_activities.activity_id
where syllabi.lifecycle = 'published'
  and activities.lifecycle = 'published';

revoke all on public.activities, public.exercises, public.activity_blocks,
  public.syllabi, public.syllabus_activities from anon, authenticated;
revoke all on public.published_activity_catalog, public.published_syllabus_catalog
  from anon, authenticated;

grant select on public.published_activity_catalog, public.published_syllabus_catalog
  to anon, authenticated;
grant select (id, title, summary, cover_asset_url, level, lifecycle, access_policy)
  on public.activities to authenticated;
grant select (id, activity_id, title) on public.exercises to authenticated;
grant select on public.activity_blocks to authenticated;

drop policy if exists published_activities_select on public.activities;
drop policy if exists published_exercises_select on public.exercises;
drop policy if exists published_activity_blocks_select on public.activity_blocks;
drop policy if exists published_syllabi_select on public.syllabi;
drop policy if exists published_syllabus_activities_select on public.syllabus_activities;

create policy free_activities_select
on public.activities
for select
to authenticated
using (
  lifecycle = 'published'
  and access_policy = 'free'
  and public.pfy_has_authenticated_identity()
);

create policy free_exercises_select
on public.exercises
for select
to authenticated
using (
  public.pfy_has_authenticated_identity()
  and exists (
    select 1
    from public.activities
    where activities.id = exercises.activity_id
      and activities.lifecycle = 'published'
      and activities.access_policy = 'free'
  )
);

create policy free_activity_blocks_select
on public.activity_blocks
for select
to authenticated
using (
  public.pfy_has_authenticated_identity()
  and exists (
    select 1
    from public.activities
    where activities.id = activity_blocks.activity_id
      and activities.lifecycle = 'published'
      and activities.access_policy = 'free'
  )
);
