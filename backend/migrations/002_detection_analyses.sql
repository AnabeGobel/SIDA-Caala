create table if not exists public.detection_analyses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete cascade,
    filename text not null,
    image_storage_path text not null,
    image_content_type text not null,
    image_width integer not null check (image_width > 0),
    image_height integer not null check (image_height > 0),
    confidence_threshold double precision not null
        check (confidence_threshold between 0.01 and 0.99),
    inference_ms integer not null check (inference_ms >= 0),
    fps double precision not null check (fps >= 0),
    has_alert boolean not null default false,
    detections jsonb not null default '[]'::jsonb
        check (jsonb_typeof(detections) = 'array'),
    created_at timestamptz not null default now()
);

create index if not exists detection_analyses_created_at_idx
    on public.detection_analyses (created_at desc);
create index if not exists detection_analyses_user_created_at_idx
    on public.detection_analyses (user_id, created_at desc);

alter table public.detection_analyses enable row level security;
grant all privileges on table public.detection_analyses to service_role;

drop policy if exists "Users can read own detection analyses"
    on public.detection_analyses;
create policy "Users can read own detection analyses"
    on public.detection_analyses
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own detection analyses"
    on public.detection_analyses;
create policy "Users can insert own detection analyses"
    on public.detection_analyses
    for insert
    to authenticated
    with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('analysis-images', 'analysis-images', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read own analysis images" on storage.objects;
create policy "Users can read own analysis images"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'analysis-images'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "Users can upload own analysis images" on storage.objects;
create policy "Users can upload own analysis images"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'analysis-images'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "Users can delete own analysis images" on storage.objects;
create policy "Users can delete own analysis images"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'analysis-images'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
