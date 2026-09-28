-- Phase 4: preserve every existing relation, ID and timestamp.
-- Prevent writes between the audit and the new constraint (migration is atomic).
lock table public.connections in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.connections where status = 'rejected') then
    raise exception 'Connections migration: review existing rejected relations manually before retrying.';
  end if;
end $$;

alter table public.connections drop constraint connections_status_check;
alter table public.connections add constraint connections_status_check
  check (status in ('pending', 'accepted'));
alter table public.connections enable row level security;

revoke all on public.connections from public, anon, authenticated;
-- Table-level revocation does not revoke existing column-level grants.
revoke update (status) on public.connections from authenticated;
grant select, delete on public.connections to authenticated;
grant insert (requester_id, receiver_id, status) on public.connections to authenticated;
grant update (status) on public.connections to authenticated;

drop policy connections_read on public.connections;
drop policy connections_request on public.connections;
drop policy connections_respond on public.connections;
drop policy connections_delete on public.connections;

-- Reuse the Phase 3 lookup: membership, confirmed email, ban and institution.
-- Profile RLS also applies inside these subqueries.
create policy connections_read on public.connections for select to authenticated
using (
  (select private.is_member())
  and exists (
    select 1 from public.profiles a, public.profiles b
    where a.id = requester_id and b.id = receiver_id
      and (a.user_id = (select auth.uid()) or b.user_id = (select auth.uid()))
      and a.institution_id = 'fatece' and b.institution_id = a.institution_id
      and private.is_active_student(a.user_id) and private.is_active_student(b.user_id)
  )
);
create policy connections_request on public.connections for insert to authenticated
with check (
  (select private.is_member()) and status = 'pending'
  and exists (
    select 1 from public.profiles a, public.profiles b
    where a.id = requester_id and b.id = receiver_id
      and a.user_id = (select auth.uid()) and a.id <> b.id
      and a.institution_id = 'fatece' and b.institution_id = a.institution_id
      and private.is_active_student(a.user_id) and private.is_active_student(b.user_id)
  )
);
create policy connections_respond on public.connections for update to authenticated
using (
  (select private.is_member()) and status = 'pending'
  and exists (
    select 1 from public.profiles a, public.profiles b
    where a.id = requester_id and b.id = receiver_id
      and b.user_id = (select auth.uid())
      and a.institution_id = 'fatece' and b.institution_id = a.institution_id
      and private.is_active_student(a.user_id) and private.is_active_student(b.user_id)
  )
)
with check (
  (select private.is_member()) and status = 'accepted'
  and exists (
    select 1 from public.profiles a, public.profiles b
    where a.id = requester_id and b.id = receiver_id
      and b.user_id = (select auth.uid())
      and a.institution_id = 'fatece' and b.institution_id = a.institution_id
      and private.is_active_student(a.user_id) and private.is_active_student(b.user_id)
  )
);
create policy connections_delete on public.connections for delete to authenticated
using (
  (select private.is_member()) and status in ('pending', 'accepted')
  and exists (
    select 1 from public.profiles p where p.id in (requester_id, receiver_id)
      and p.user_id = (select auth.uid()) and p.institution_id = 'fatece'
      and private.is_active_student(p.user_id)
  )
);

comment on table public.connections is
  'Mutual student relationships. Decline/cancel/remove deletes the relation; rejection is not a social block.';
-- Phase 4: preserve every existing relation, ID and timestamp.
-- Prevent writes between the audit and the new constraint (migration is atomic).
lock table public.connections in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.connections where status = 'rejected') then
    raise exception 'Connections migration: review existing rejected relations manually before retrying.';
  end if;
end $$;

alter table public.connections drop constraint connections_status_check;
alter table public.connections add constraint connections_status_check
  check (status in ('pending', 'accepted'));
alter table public.connections enable row level security;

revoke all on public.connections from public, anon, authenticated;
-- Table-level revocation does not revoke existing column-level grants.
revoke update (status) on public.connections from authenticated;
grant select, delete on public.connections to authenticated;
grant insert (requester_id, receiver_id, status) on public.connections to authenticated;
grant update (status) on public.connections to authenticated;

drop policy connections_read on public.connections;
drop policy connections_request on public.connections;
drop policy connections_respond on public.connections;
drop policy connections_delete on public.connections;

-- Reuse the Phase 3 lookup: membership, confirmed email, ban and institution.
-- Profile RLS also applies inside these subqueries.
create policy connections_read on public.connections for select to authenticated
using (
  (select private.is_member())
  and exists (
    select 1 from public.profiles a, public.profiles b
    where a.id = requester_id and b.id = receiver_id
      and (a.user_id = (select auth.uid()) or b.user_id = (select auth.uid()))
      and a.institution_id = 'fatece' and b.institution_id = a.institution_id
      and private.is_active_student(a.user_id) and private.is_active_student(b.user_id)
  )
);
create policy connections_request on public.connections for insert to authenticated
with check (
  (select private.is_member()) and status = 'pending'
  and exists (
    select 1 from public.profiles a, public.profiles b
    where a.id = requester_id and b.id = receiver_id
      and a.user_id = (select auth.uid()) and a.id <> b.id
      and a.institution_id = 'fatece' and b.institution_id = a.institution_id
      and private.is_active_student(a.user_id) and private.is_active_student(b.user_id)
  )
);
create policy connections_respond on public.connections for update to authenticated
using (
  (select private.is_member()) and status = 'pending'
  and exists (
    select 1 from public.profiles a, public.profiles b
    where a.id = requester_id and b.id = receiver_id
      and b.user_id = (select auth.uid())
      and a.institution_id = 'fatece' and b.institution_id = a.institution_id
      and private.is_active_student(a.user_id) and private.is_active_student(b.user_id)
  )
)
with check (
  (select private.is_member()) and status = 'accepted'
  and exists (
    select 1 from public.profiles a, public.profiles b
    where a.id = requester_id and b.id = receiver_id
      and b.user_id = (select auth.uid())
      and a.institution_id = 'fatece' and b.institution_id = a.institution_id
      and private.is_active_student(a.user_id) and private.is_active_student(b.user_id)
  )
);
create policy connections_delete on public.connections for delete to authenticated
using (
  (select private.is_member()) and status in ('pending', 'accepted')
  and exists (
    select 1 from public.profiles p where p.id in (requester_id, receiver_id)
      and p.user_id = (select auth.uid()) and p.institution_id = 'fatece'
      and private.is_active_student(p.user_id)
  )
);

comment on table public.connections is
  'Mutual student relationships. Decline/cancel/remove deletes the relation; rejection is not a social block.';
