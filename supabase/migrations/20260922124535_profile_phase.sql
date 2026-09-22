-- Phase 2: keep institutional identity immutable through the Data API.
revoke insert, delete on public.profiles from authenticated;
revoke update (name, course, semester, institution) on public.profiles from authenticated;
drop policy profiles_insert on public.profiles;
drop policy profiles_delete on public.profiles;

create function private.normalize_profile_label(value text) returns text
language sql immutable strict security invoker set search_path = ''
as $$ select lower(btrim(regexp_replace(normalize(value, NFC), '[[:space:]]+', ' ', 'g'))); $$;
revoke all on function private.normalize_profile_label(text) from public, anon, authenticated;

-- Preserve every existing row and association. If a catalog already contains
-- equivalent names, the unique index aborts the migration transaction; review
-- those entries separately instead of deleting or merging records automatically.
alter table public.skills add column normalized_name text
  generated always as (private.normalize_profile_label(name)) stored;
alter table public.interests add column normalized_name text
  generated always as (private.normalize_profile_label(name)) stored;
create unique index skills_normalized_name_key on public.skills (normalized_name);
create unique index interests_normalized_name_key on public.interests (normalized_name);

-- No new client INSERT privileges on either catalog. Creation stays server-side.
comment on column public.skills.normalized_name is 'Case/whitespace/NFC-insensitive identity; name retains its readable spelling.';
comment on column public.interests.normalized_name is 'Case/whitespace/NFC-insensitive identity; name retains its readable spelling.';
