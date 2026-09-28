-- SPEC-005: persistent mapping between canonical PFY Exercise identity and Lumi runtime content identity.

create table public.exercise_h5p_mappings (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null unique references public.exercises (id) on delete cascade,
  lumi_content_id text not null check (btrim(lumi_content_id) <> ''),
  implementation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(implementation_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger exercise_h5p_mappings_set_updated_at
before update on public.exercise_h5p_mappings
for each row execute function public.pfy_set_updated_at();

alter table public.exercise_h5p_mappings enable row level security;

revoke all on public.exercise_h5p_mappings from anon, authenticated;

-- Only privileged server-side/service-role contexts may read this mapping.
-- The PFY H5P Adapter issues runtime tokens; ordinary users never see Lumi IDs.
-- No select grant is given to anon/authenticated here.
