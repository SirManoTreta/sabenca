-- Institution authorization is independent of Supabase Auth and social profiles.
create table private.institutions (
 id text primary key check (id = 'fatece'),
 name text not null
);
insert into private.institutions values ('fatece', 'FATECE');
create table private.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 institution_id text not null references private.institutions(id),
 created_at timestamptz not null default now()
);
create table private.import_batches (
 id uuid primary key default gen_random_uuid(),
 institution_id text not null references private.institutions(id),
 file_name text not null check (char_length(file_name) <= 180),
 uploaded_by uuid not null references auth.users(id),
 receipt_id uuid not null unique,
 total_rows integer not null check (total_rows between 1 and 1000),
 valid_rows integer not null check (valid_rows >= 0),
 invalid_rows integer not null check (invalid_rows >= 0),
 created_at timestamptz not null default now(),
 check (total_rows = valid_rows + invalid_rows)
);
create table private.institution_students (
 id uuid primary key default gen_random_uuid(),
 institution_id text not null references private.institutions(id),
 auth_user_id uuid unique references auth.users(id) on delete set null,
 ra text not null check (ra ~ '^[A-Za-z0-9._-]{1,30}$'),
 name text not null check (char_length(btrim(name)) between 2 and 100),
 email text not null check (email = lower(btrim(email)) and char_length(email) <= 254),
 phone text not null check (phone ~ '^55[0-9]{10,11}$'),
 birth_date date not null check (birth_date >= date '1900-01-01'),
 cpf_fingerprint text not null check (cpf_fingerprint ~ '^[a-f0-9]{64}$'),
 course text check (char_length(course) <= 120),
 semester smallint check (semester between 1 and 30),
 status text not null default 'pending' check (status in ('pending','active','blocked','inactive')),
 import_batch_id uuid references private.import_batches(id),
 created_at timestamptz not null default now(),
 activated_at timestamptz,
 updated_at timestamptz not null default now(),
 unique (institution_id, ra), unique (institution_id, email), unique (institution_id, cpf_fingerprint),
 check (status <> 'active' or (auth_user_id is not null and activated_at is not null))
);
create index institution_students_status_idx on private.institution_students (institution_id, status, created_at desc);
create index institution_students_batch_idx on private.institution_students (import_batch_id);
create index import_batches_actor_idx on private.import_batches (uploaded_by);
create index import_batches_institution_idx on private.import_batches (institution_id, created_at desc);
create index admin_users_institution_idx on private.admin_users (institution_id);
create table private.activation_challenges (
 token_hash text primary key,
 student_id uuid not null references private.institution_students(id) on delete cascade,
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index activation_challenges_student_idx on private.activation_challenges (student_id);
create index activation_challenges_user_idx on private.activation_challenges (auth_user_id);
create index activation_challenges_expiry_idx on private.activation_challenges (expires_at);
create table private.auth_attempts (
 key text primary key,
 attempts integer not null,
 expires_at timestamptz not null
);
create index auth_attempts_expiry_idx on private.auth_attempts (expires_at);
create table private.access_events (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references private.institution_students(id),
 changed_by uuid not null references auth.users(id),
 old_status text not null,
 new_status text not null,
 created_at timestamptz not null default now()
);
create index access_events_student_idx on private.access_events(student_id);
create index access_events_actor_idx on private.access_events(changed_by);
create trigger institution_students_updated before update on private.institution_students for each row execute function private.touch_updated_at();

-- Private tables have no client grants or permissive RLS policies, including for admins.
-- The Next.js server uses a restricted, non-public database connection and checks each actor.
alter table private.institutions enable row level security;
revoke all on private.institutions from public, anon, authenticated;
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;
alter table private.import_batches enable row level security;
revoke all on private.import_batches from public, anon, authenticated;
alter table private.institution_students enable row level security;
revoke all on private.institution_students from public, anon, authenticated;
alter table private.activation_challenges enable row level security;
revoke all on private.activation_challenges from public, anon, authenticated;
alter table private.auth_attempts enable row level security;
revoke all on private.auth_attempts from public, anon, authenticated;
alter table private.access_events enable row level security;
revoke all on private.access_events from public, anon, authenticated;
create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$
 select exists (
  select 1 from auth.users u join private.institution_students s on s.auth_user_id = u.id
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null
   and coalesce(u.is_anonymous, false) = false and (u.banned_until is null or u.banned_until < now())
   and s.status = 'active' and s.institution_id = 'fatece' and lower(u.email) = s.email
 );
$$;
-- These wrappers expose only the current caller's booleans, never institutional records.
create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
 select exists (
  select 1 from private.admin_users a join auth.users u on u.id = a.user_id
  where u.id = (select auth.uid()) and a.institution_id = 'fatece'
   and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false) = false
   and (u.banned_until is null or u.banned_until < now())
 );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
create function public.access_context() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('member', private.is_member(), 'admin', private.is_admin()); $$;
revoke all on function public.access_context() from public, anon;
grant execute on function public.access_context() to authenticated;

-- Defense in depth: disable arbitrary Auth registrations even if dashboard signup is toggled.
-- SECURITY INVOKER: Auth's internal role can look up allowed emails, API users cannot.
grant usage on schema private to supabase_auth_admin;
grant select (email) on private.institution_students to supabase_auth_admin;
create policy auth_registration_lookup on private.institution_students for select to supabase_auth_admin using (true);
create function private.guard_auth_signup() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
 if current_user not in ('postgres', 'service_role', 'supabase_admin') and coalesce(new.raw_app_meta_data->>'sabenca_admin', 'false') <> 'true' and
    not exists (select 1 from private.institution_students where email = lower(new.email)) then
  raise exception 'Institutional authorization required' using errcode = '42501';
 end if;
 return new;
end;
$$;
revoke all on function private.guard_auth_signup() from public, anon, authenticated;
create trigger sabenca_closed_signup before insert on auth.users for each row execute function private.guard_auth_signup();
