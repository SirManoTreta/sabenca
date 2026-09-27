-- Phase 3: additive migration. Legacy course text is retained for audit only.
-- Lock sources until all references and guards have been validated.
lock table private.institution_students, public.profiles in share row exclusive mode;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null references private.institutions(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  normalized_name text generated always as (private.normalize_profile_label(name)) stored,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, normalized_name),
  unique (institution_id, id)
);
alter table public.courses enable row level security;
revoke all on public.courses from public, anon, authenticated;
grant select on public.courses to authenticated;
create trigger courses_updated before update on public.courses
  for each row execute function private.touch_updated_at();

-- Only case, whitespace and NFC are equivalent. Do not guess aliases/accents.
do $$
begin
  if exists (
    select 1 from public.profiles p
    left join private.institution_students s on s.auth_user_id = p.user_id
    where s.id is null or p.institution is distinct from 'FATECE'
      or private.normalize_profile_label(nullif(btrim(p.course), ''))
        is distinct from private.normalize_profile_label(nullif(btrim(s.course), ''))
  ) then
    raise exception 'Course migration: review unmatched profiles or conflicting institutional courses.';
  end if;
  if exists (
    select 1 from private.institution_students
    where nullif(btrim(course), '') is not null
      and char_length(private.normalize_profile_label(course)) not between 2 and 120
  ) then
    raise exception 'Course migration: review invalid existing course names.';
  end if;
end $$;

insert into public.courses (institution_id, name)
select institution_id, min(btrim(regexp_replace(normalize(course, NFC), '[[:space:]]+', ' ', 'g')))
from private.institution_students where nullif(btrim(course), '') is not null
group by institution_id, private.normalize_profile_label(course);

alter table private.institution_students add column course_id uuid;
alter table public.profiles add column course_id uuid;
alter table public.profiles add column institution_id text;
update private.institution_students s set course_id = c.id
from public.courses c where c.institution_id = s.institution_id
  and c.normalized_name = private.normalize_profile_label(s.course);
update public.profiles p set course_id = s.course_id, institution_id = s.institution_id
from private.institution_students s where s.auth_user_id = p.user_id;
alter table public.profiles alter column institution_id set not null;
alter table public.profiles add constraint profiles_institution_fk
  foreign key (institution_id) references private.institutions(id) on delete restrict;
alter table private.institution_students add constraint students_course_fk
  foreign key (institution_id, course_id) references public.courses(institution_id, id) on delete restrict;
alter table public.profiles add constraint profiles_course_fk
  foreign key (institution_id, course_id) references public.courses(institution_id, id) on delete restrict;
alter table private.institution_students add constraint students_course_migrated
  check (nullif(btrim(course), '') is null or course_id is not null);
alter table public.profiles add constraint profiles_course_migrated
  check (nullif(btrim(course), '') is null or course_id is not null);
create index students_course_idx on private.institution_students(institution_id, course_id);
create index profiles_catalog_semester_idx on public.profiles(institution_id, course_id, semester);
create index profiles_networks_name_idx on public.profiles(name, id) where username is not null;
comment on column private.institution_students.course is 'Legacy audit text. Application uses course_id and courses.name.';
comment on column public.profiles.course is 'Legacy audit text. Application uses course_id and courses.name.';

-- A member may read inactive course labels to preserve historical profiles;
-- the default Networks filter explicitly requests active courses only.
create policy courses_read on public.courses for select to authenticated using (
  institution_id = 'fatece' and ((select private.is_member()) or (select private.is_admin()))
);

create function private.guard_student_course() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.course_id is not null and (TG_OP = 'INSERT' or new.course_id is distinct from old.course_id
      or new.institution_id is distinct from old.institution_id) then
    perform id from public.courses where id = new.course_id and institution_id = new.institution_id
      and status = 'active' for share;
    if not found then raise exception 'An active institutional course is required.' using errcode = '23514'; end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_student_course() from public, anon, authenticated;
create trigger students_course_guard before insert or update of course_id, institution_id
  on private.institution_students for each row execute function private.guard_student_course();

-- Institutional updates propagate references, never duplicate catalog names.
create function private.sync_profile_academics() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.profiles set course_id = new.course_id, institution_id = new.institution_id,
    name = new.name, semester = new.semester
  where user_id = new.auth_user_id;
  return new;
end $$;
revoke all on function private.sync_profile_academics() from public, anon, authenticated;
create trigger students_sync_profile after update of course_id, institution_id, name, semester
  on private.institution_students for each row execute function private.sync_profile_academics();

-- Private lookup exposes only a boolean and requires an authorized caller.
create function private.is_active_student(target_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (select private.is_member()) and exists (
    select 1 from private.institution_students s join auth.users u on u.id = s.auth_user_id
    where s.auth_user_id = target_user and s.institution_id = 'fatece' and s.status = 'active'
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false)
      and (u.banned_until is null or u.banned_until < now()) and lower(u.email) = s.email
  );
$$;
revoke all on function private.is_active_student(uuid) from public, anon;
grant execute on function private.is_active_student(uuid) to authenticated;
alter policy members_read on public.profiles to authenticated using (
  (select private.is_member()) and private.is_active_student(user_id)
);
