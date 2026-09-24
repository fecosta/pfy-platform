-- SPEC-004: canonical Activities, Exercises, Syllabus/Percursos and composition.
-- This migration intentionally contains no runtime, attempt, progress or access-domain data.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  summary text not null default '',
  cover_asset_url text,
  level text,
  discovery_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(discovery_metadata) = 'object'),
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  title text not null default '' check (btrim(title) <> '' or title = ''),
  implementation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(implementation_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, activity_id)
);

create table public.activity_blocks (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  position integer not null check (position > 0),
  block_type text not null check (
    block_type in ('editorial', 'heading', 'reflection', 'image', 'video', 'infographic', 'embed', 'exercise')
  ),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  exercise_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, position),
  unique (activity_id, exercise_id),
  constraint activity_blocks_exercise_shape check (
    (block_type = 'exercise' and exercise_id is not null)
    or (block_type <> 'exercise' and exercise_id is null)
  ),
  constraint activity_blocks_exercise_owner_fk
    foreign key (exercise_id, activity_id)
    references public.exercises (id, activity_id)
    on delete cascade
);

create table public.syllabi (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  description text not null default '',
  level text,
  expected_workload text,
  discovery_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(discovery_metadata) = 'object'),
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.syllabus_activities (
  syllabus_id uuid not null references public.syllabi (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete restrict,
  position integer not null check (position > 0),
  pedagogical_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(pedagogical_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (syllabus_id, activity_id),
  unique (syllabus_id, position)
);

create index syllabus_activities_activity_id_idx on public.syllabus_activities (activity_id);

create trigger activities_set_updated_at
before update on public.activities
for each row execute function public.pfy_set_updated_at();

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.pfy_set_updated_at();

create trigger activity_blocks_set_updated_at
before update on public.activity_blocks
for each row execute function public.pfy_set_updated_at();

create trigger syllabi_set_updated_at
before update on public.syllabi
for each row execute function public.pfy_set_updated_at();

create trigger syllabus_activities_set_updated_at
before update on public.syllabus_activities
for each row execute function public.pfy_set_updated_at();

alter table public.activities enable row level security;
alter table public.exercises enable row level security;
alter table public.activity_blocks enable row level security;
alter table public.syllabi enable row level security;
alter table public.syllabus_activities enable row level security;

revoke all on public.activities, public.exercises, public.activity_blocks,
  public.syllabi, public.syllabus_activities from anon, authenticated;

grant select on public.activities, public.activity_blocks, public.syllabi,
  public.syllabus_activities to anon, authenticated;
grant select (id, activity_id, title) on public.exercises to anon, authenticated;

create policy published_activities_select
on public.activities
for select
to anon, authenticated
using (lifecycle = 'published');

create policy published_exercises_select
on public.exercises
for select
to anon, authenticated
using (
  exists (
    select 1 from public.activities
    where activities.id = exercises.activity_id
      and activities.lifecycle = 'published'
  )
);

create policy published_activity_blocks_select
on public.activity_blocks
for select
to anon, authenticated
using (
  exists (
    select 1 from public.activities
    where activities.id = activity_blocks.activity_id
      and activities.lifecycle = 'published'
  )
);

create policy published_syllabi_select
on public.syllabi
for select
to anon, authenticated
using (lifecycle = 'published');

create policy published_syllabus_activities_select
on public.syllabus_activities
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.syllabi
    join public.activities on activities.id = syllabus_activities.activity_id
    where syllabi.id = syllabus_activities.syllabus_id
      and syllabi.lifecycle = 'published'
      and activities.lifecycle = 'published'
  )
);
