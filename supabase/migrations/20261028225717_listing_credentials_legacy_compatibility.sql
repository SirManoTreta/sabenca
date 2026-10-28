-- Apply with 20261027191347 in ONE transaction when upgrading a 14-migration
-- database. Its intermediate legacy guard must never become visible to writers.
lock table public.listings,public.listing_certificates in share row exclusive mode;

-- This column is a database-maintained projection, never a second source.
-- Defer the projection FK until the authoritative ON DELETE CASCADE and its
-- projection trigger have selected the next surviving document (or NULL).
alter table public.listings drop constraint listings_certificate_id_fkey;
alter table public.listings add constraint listings_certificate_id_fkey
 foreign key(certificate_id) references public.profile_certificates(id)
 deferrable initially deferred;

create or replace function private.guard_listing_certificate() returns trigger
language plpgsql security definer set search_path='' as $$
declare seller uuid; service boolean; projected uuid;
begin
 if tg_op='UPDATE' and pg_trigger_depth()>1 then
  select certificate_id into projected from public.listing_certificates
  where listing_id=new.id order by position limit 1;
  -- A nested write may only mirror the authoritative projection. Checking the
  -- complete remaining row prevents a trigger-depth-only authorization bypass.
  if new.certificate_id is not distinct from projected
  and (to_jsonb(new)-'certificate_id'-'updated_at')=(to_jsonb(old)-'certificate_id'-'updated_at') then
   return new;
  end if;
 end if;
 select user_id into seller from public.profiles where id=new.seller_id;
 if current_setting('role',true)='authenticated' and
 (auth.uid() is distinct from seller or not private.is_member()) then
  raise exception 'Listing credential unavailable' using errcode='42501';
 end if;
 if tg_op='UPDATE' and new.seller_id is distinct from old.seller_id and
 exists(select 1 from public.listing_certificates where listing_id=old.id) then
  raise exception 'Listing owner cannot change with credentials' using errcode='23514';
 end if;
 select is_service into service from public.categories where id=new.category_id;
 if service is false then new.certificate_id=null; end if;
 -- Category cleanup is AFTER the parent update, so a BEFORE trigger never
 -- updates its own pending parent tuple through a junction projection trigger.
 return new;
end $$;

-- Establish the projection for already-upgraded DEV data before installing
-- the legacy write adapter. Only divergent projections are changed.
update public.listings l set certificate_id=(
 select r.certificate_id from public.listing_certificates r
 where r.listing_id=l.id order by r.position limit 1)
where l.certificate_id is distinct from (
 select r.certificate_id from public.listing_certificates r
 where r.listing_id=l.id order by r.position limit 1);
comment on column public.listings.certificate_id is
 'Deprecated database-maintained projection of the first historical listing_certificates row. The junction is authoritative; legacy writes are adapted atomically only when unambiguous.';

create function private.require_listing_certificate_read_committed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- An authenticated transaction opened before the migration must not use an
 -- old repeatable snapshot which cannot see the newly backfilled junction.
 -- Statement triggers also cover a DELETE that sees zero rows in that snapshot.
 -- Application requests use READ COMMITTED; privileged migration snapshots are
 -- unaffected. Do not silently accept a credential write in another isolation.
 if current_setting('role',true)='authenticated'
 and current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Credential writes require read committed isolation' using errcode='23514';
 end if;
 return null;
end $$;
revoke all on function private.require_listing_certificate_read_committed() from public,anon,authenticated;
create trigger listing_00_legacy_certificate_isolation
before insert or update of certificate_id on public.listings
for each statement execute function private.require_listing_certificate_read_committed();
create trigger listing_certificates_isolation
before insert or update or delete on public.listing_certificates
for each statement execute function private.require_listing_certificate_read_committed();

create function private.guard_legacy_listing_certificate_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare projected uuid; linked_count integer; seller uuid; service boolean;
begin
 if tg_op='UPDATE' then
  -- The UPDATE already holds the parent row lock. These VOLATILE PL/pgSQL
  -- statements see committed junction changes after any parent-lock wait.
  select certificate_id into projected from public.listing_certificates
  where listing_id=new.id order by position limit 1;
  if pg_trigger_depth()>1 and new.certificate_id is not distinct from projected
  and (to_jsonb(new)-'certificate_id'-'updated_at')=(to_jsonb(old)-'certificate_id'-'updated_at') then
   return new;
  end if;
  select count(*) into linked_count from public.listing_certificates where listing_id=new.id;
  if linked_count>1 then
   raise exception 'Multiple credentials require the current application' using errcode='23514';
  end if;
  if new.certificate_id is distinct from old.certificate_id then
   -- Old forms submit certificate_id even when editing only title/description.
   -- Without an optimistic version token, a changed target plus other edits is
   -- ambiguous: reject the entire request rather than overwrite a newer choice.
   if (to_jsonb(new)-'certificate_id'-'updated_at') is distinct from
      (to_jsonb(old)-'certificate_id'-'updated_at') then
    raise exception 'Change credentials separately in the legacy application' using errcode='23514';
   end if;
   select user_id into seller from public.profiles where id=new.seller_id;
   -- An ineligible historical document is absent from the old form. Its empty
   -- selection cannot safely express an intentional removal or replacement.
   if linked_count=1 and not private.listing_certificate_eligible(projected,seller) then
    raise exception 'Historical credentials require the current application' using errcode='23514';
   end if;
  end if;
 end if;
 if new.certificate_id is not null then
  select is_service into service from public.categories where id=new.category_id;
  if service is distinct from true then
   raise exception 'Only services accept credentials' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_legacy_listing_certificate_write() from public,anon,authenticated;
-- Alphabetically before listing_certificate/category cleanup, including an old
-- service-to-product payload which also explicitly clears certificate_id.
create trigger listing_00_legacy_certificate_write
before insert or update of certificate_id on public.listings
for each row execute function private.guard_legacy_listing_certificate_write();

create function private.apply_legacy_listing_certificate_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare projected uuid;
begin
 select certificate_id into projected from public.listing_certificates
 where listing_id=new.id order by position limit 1;
 -- Includes ordinary old saves of an unchanged selection and nested projection
 -- updates. Neither is allowed to delete/reinsert historical relationships.
 if new.certificate_id is not distinct from projected then return new; end if;
 delete from public.listing_certificates where listing_id=new.id;
 if new.certificate_id is not null then
  -- The existing junction guard rechecks ownership, service kind, dates,
  -- approval and evidence on locked certificate/storage versions.
  insert into public.listing_certificates(listing_id,certificate_id,position)
  values(new.id,new.certificate_id,0);
 end if;
 return new;
end $$;
revoke all on function private.apply_legacy_listing_certificate_write() from public,anon,authenticated;
create trigger listing_legacy_certificate_write
after insert or update of certificate_id on public.listings
for each row execute function private.apply_legacy_listing_certificate_write();

create function private.clear_product_listing_certificates() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.categories where id=new.category_id and not is_service) then
  delete from public.listing_certificates where listing_id=new.id;
 end if;
 return new;
end $$;
revoke all on function private.clear_product_listing_certificates() from public,anon,authenticated;
create trigger listing_product_certificate_cleanup
after update of category_id on public.listings
for each row execute function private.clear_product_listing_certificates();

create function private.lock_listing_certificate_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- New application saves already acquire this lock before changing the set.
 -- Direct API deletes must also serialize with legacy parent writes. A parent
 -- already deleted by its FK cascade needs no projection or authorization work.
 perform 1 from public.listings where id=old.listing_id for update;
 return old;
end $$;
revoke all on function private.lock_listing_certificate_delete() from public,anon,authenticated;
create trigger listing_certificates_delete_lock before delete on public.listing_certificates
for each row execute function private.lock_listing_certificate_delete();

create function private.project_listing_certificate() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid; projected uuid;
begin
 target=case when tg_op='DELETE' then old.listing_id else new.listing_id end;
 perform 1 from public.listings where id=target for update;
 if not found then return null; end if;
 select certificate_id into projected from public.listing_certificates
 where listing_id=target order by position limit 1;
 update public.listings set certificate_id=projected
 where id=target and certificate_id is distinct from projected;
 if tg_op='UPDATE' and old.listing_id is distinct from new.listing_id then
  select certificate_id into projected from public.listing_certificates
  where listing_id=old.listing_id order by position limit 1;
  update public.listings set certificate_id=projected
  where id=old.listing_id and certificate_id is distinct from projected;
 end if;
 return null;
end $$;
revoke all on function private.project_listing_certificate() from public,anon,authenticated;
create trigger listing_certificates_projection after insert or update or delete on public.listing_certificates
for each row execute function private.project_listing_certificate();
