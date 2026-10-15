-- Keep incomplete provisioning visible and retryable; never delete an existing Auth account.
alter table private.admin_invitations add column provisioned_user_id uuid references auth.users(id) on delete set null;
alter table private.admin_invitations add column delivery_failed boolean not null default false;
create table private.admin_access_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 target_id uuid not null references auth.users(id),
 operation text not null check (operation in ('grant','revoke')),
 created_at timestamptz not null default now()
);
alter table private.admin_access_events enable row level security;
revoke all on private.admin_access_events from public, anon, authenticated;
create index admin_access_events_actor_idx on private.admin_access_events(actor_id);
create index admin_access_events_target_idx on private.admin_access_events(target_id);

-- All revocations, including maintenance SQL, preserve at least one confirmed admin.
create function private.guard_admin_revocation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(72619410);
 if old.user_id = auth.uid() then
   raise exception 'Administrators cannot revoke themselves' using errcode='23514';
 end if;
 if not exists (
   select 1 from private.admin_users a join auth.users u on u.id=a.user_id
   where a.user_id<>old.user_id and a.institution_id=old.institution_id
     and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
     and (u.banned_until is null or u.banned_until<now())
 ) then
   raise exception 'Keep at least one confirmed administrator' using errcode='23514';
 end if;
 return old;
end $$;
revoke all on function private.guard_admin_revocation() from public, anon, authenticated;
create trigger protect_admin_revocation before delete on private.admin_users
for each row execute function private.guard_admin_revocation();
