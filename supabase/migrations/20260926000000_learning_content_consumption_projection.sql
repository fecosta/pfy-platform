-- SPEC-004 final reconciliation: expose only approved ActivityBlock consumption fields.

-- A published Percurso remains discoverable even when no member Activity is
-- currently published. Non-visible membership rows become null Activity columns.
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
left join public.syllabus_activities
  on syllabus_activities.syllabus_id = syllabi.id
left join public.activities
  on activities.id = syllabus_activities.activity_id
  and activities.lifecycle = 'published'
where syllabi.lifecycle = 'published';

create or replace view public.free_activity_block_consumption
with (security_barrier = true)
as
select
  activity_blocks.id,
  activity_blocks.activity_id,
  activity_blocks.position,
  activity_blocks.block_type,
  case activity_blocks.block_type
    when 'editorial' then jsonb_build_object('text', activity_blocks.content -> 'text')
    when 'heading' then jsonb_build_object('text', activity_blocks.content -> 'text')
    when 'reflection' then jsonb_build_object('prompt', activity_blocks.content -> 'prompt')
    when 'image' then jsonb_build_object(
      'src', activity_blocks.content -> 'src',
      'alt', activity_blocks.content -> 'alt'
    )
    when 'video' then jsonb_strip_nulls(jsonb_build_object(
      'src', activity_blocks.content -> 'src',
      'title', activity_blocks.content -> 'title'
    ))
    when 'infographic' then jsonb_build_object(
      'src', activity_blocks.content -> 'src',
      'alt', activity_blocks.content -> 'alt'
    )
    when 'embed' then jsonb_strip_nulls(jsonb_build_object(
      'url', activity_blocks.content -> 'url',
      'title', activity_blocks.content -> 'title'
    ))
    when 'exercise' then '{}'::jsonb
  end as content,
  activity_blocks.exercise_id
from public.activity_blocks
join public.activities
  on activities.id = activity_blocks.activity_id
where activities.lifecycle = 'published'
  and activities.access_policy = 'free'
  and public.pfy_has_authenticated_identity();

revoke all on public.activity_blocks from anon, authenticated;
revoke all on public.free_activity_block_consumption from anon, authenticated;
grant select on public.free_activity_block_consumption to authenticated;
