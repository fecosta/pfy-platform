-- SPEC-004 final reconciliation: hide non-public Percurso memberships from discovery.

create or replace view public.published_syllabus_catalog
with (security_barrier = true)
as
select
  syllabi.id as syllabus_id,
  syllabi.title as syllabus_title,
  syllabi.description as syllabus_description,
  syllabi.level as syllabus_level,
  syllabi.expected_workload,
  visible_memberships.position,
  visible_memberships.activity_id,
  visible_memberships.activity_title,
  visible_memberships.activity_summary,
  visible_memberships.activity_cover_asset_url,
  visible_memberships.activity_level,
  visible_memberships.access_policy
from public.syllabi
left join (
  select
    syllabus_activities.syllabus_id,
    syllabus_activities.position,
    activities.id as activity_id,
    activities.title as activity_title,
    activities.summary as activity_summary,
    activities.cover_asset_url as activity_cover_asset_url,
    activities.level as activity_level,
    activities.access_policy
  from public.syllabus_activities
  join public.activities
    on activities.id = syllabus_activities.activity_id
   and activities.lifecycle = 'published'
) as visible_memberships
  on visible_memberships.syllabus_id = syllabi.id
where syllabi.lifecycle = 'published';
