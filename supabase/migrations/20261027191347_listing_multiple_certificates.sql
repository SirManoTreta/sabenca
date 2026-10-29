-- The junction is authoritative. The nullable legacy column remains for a later,
-- separately reviewed removal; it is not synchronised with the new selection.
-- Old writers cannot create an unbackfilled association while this migration runs.
lock table public.listings in share row exclusive mode;
create table public.listing_certificates (
 listing_id uuid not null references public.listings(id) on delete cascade,
 certificate_id uuid not null references public.profile_certificates(id) on delete cascade,
 position smallint not null,
 created_at timestamptz not null default now(),
 primary key(listing_id,certificate_id),
 constraint listing_certificates_position_check check(position between 0 and 2),
 constraint listing_certificates_listing_id_position_key unique(listing_id,position) deferrable initially immediate
);
create index listing_certificates_certificate_idx on public.listing_certificates(certificate_id);
alter table public.listing_certificates enable row level security;
revoke all on public.listing_certificates from public,anon,authenticated;
grant select,delete on public.listing_certificates to authenticated;
grant insert(listing_id,certificate_id,position),update(position) on public.listing_certificates to authenticated;

-- Preserve every previous association, including historical documents which are
-- no longer eligible today. Read-time eligibility below never presents those as valid.
insert into public.listing_certificates(listing_id,certificate_id,position)
select id,certificate_id,0 from public.listings where certificate_id is not null;
comment on column public.listings.certificate_id is
 'Deprecated legacy snapshot. listing_certificates is authoritative; no new application writes. Retained for a separately reviewed future removal.';
comment on table public.listing_certificates is
 'Up to three student-selected service credentials, ordered by position. Eligibility is derived on every read; no professional-capacity guarantee.';

-- Internal eligibility predicate reused by writes and the safe metadata lookup.
-- Deliberately not callable by authenticated users with arbitrary seller IDs.
create function private.listing_certificate_eligible(document public.profile_certificates,seller_user uuid,has_evidence boolean) returns boolean
language sql stable set search_path='' as $$
 select document.id is not null and document.user_id=seller_user and document.status='verified'
 and document.issue_date<=(now() at time zone 'America/Sao_Paulo')::date
 and (document.expiration_date is null or document.expiration_date>=(now() at time zone 'America/Sao_Paulo')::date)
 and has_evidence;
$$;
revoke all on function private.listing_certificate_eligible(public.profile_certificates,uuid,boolean) from public,anon,authenticated;
create function private.listing_certificate_eligible(target_certificate uuid,seller_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profile_certificates c
 where c.id=target_certificate and private.listing_certificate_eligible(c,seller_user,
 private.certificate_has_evidence(c.file_path,c.verification_url)));
$$;
revoke all on function private.listing_certificate_eligible(uuid,uuid) from public,anon,authenticated;
create function private.own_listing_certificate_eligible(target_certificate uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.is_member()
 and private.listing_certificate_eligible(target_certificate,auth.uid());
$$;
revoke all on function private.own_listing_certificate_eligible(uuid) from public,anon;
grant execute on function private.own_listing_certificate_eligible(uuid) to authenticated;

create function private.listing_certificate_visible(target_listing uuid,target_certificate uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.listing_certificates r
 join public.listings l on l.id=r.listing_id
 join public.categories k on k.id=l.category_id
 join public.profiles p on p.id=l.seller_id
 where l.id=target_listing and r.certificate_id=target_certificate and k.is_service
 and private.profile_section_visible(p.id,'listings')
 and (l.status='active' or p.user_id=auth.uid())
 and (p.user_id=auth.uid() or private.listing_certificate_eligible(r.certificate_id,p.user_id)));
$$;
revoke all on function private.listing_certificate_visible(uuid,uuid) from public,anon;
grant execute on function private.listing_certificate_visible(uuid,uuid) to authenticated;

create policy listing_certificates_read on public.listing_certificates for select to authenticated
using (private.listing_certificate_visible(listing_id,certificate_id));
create policy listing_certificates_insert on public.listing_certificates for insert to authenticated with check (
 (select private.is_member()) and exists(select 1 from public.listings l join public.profiles p on p.id=l.seller_id
 where l.id=listing_id and p.user_id=(select auth.uid()) and p.institution_id='fatece'));
create policy listing_certificates_update on public.listing_certificates for update to authenticated using (
 (select private.is_member()) and exists(select 1 from public.listings l join public.profiles p on p.id=l.seller_id
 where l.id=listing_id and p.user_id=(select auth.uid()) and p.institution_id='fatece')) with check (
 (select private.is_member()) and exists(select 1 from public.listings l join public.profiles p on p.id=l.seller_id
 where l.id=listing_id and p.user_id=(select auth.uid()) and p.institution_id='fatece'));
create policy listing_certificates_delete on public.listing_certificates for delete to authenticated using (
 (select private.is_member()) and exists(select 1 from public.listings l join public.profiles p on p.id=l.seller_id
 where l.id=listing_id and p.user_id=(select auth.uid()) and p.institution_id='fatece'));

create function private.guard_listing_certificates() returns trigger
language plpgsql security definer set search_path='' as $$
declare listing public.listings; seller uuid; service boolean; document public.profile_certificates; evidence boolean;
begin
 -- Serialise against category/ownership updates of the parent. The three
 -- non-null, unique positions enforce the limit even in concurrent requests.
 select * into listing from public.listings where id=new.listing_id for update;
 select p.user_id,k.is_service into seller,service from public.profiles p,public.categories k
 where p.id=listing.seller_id and k.id=listing.category_id;
 if seller is null or (current_setting('role',true)='authenticated' and
 (auth.uid() is distinct from seller or not private.is_member())) then
  raise exception 'Listing credential unavailable' using errcode='42501';
 end if;
 if service is distinct from true then
  raise exception 'Only services accept credentials' using errcode='23514';
 end if;
 -- Reordering preserves historical associations without making an invalidated
 -- document valid again. New associations always require current eligibility.
 if tg_op='UPDATE' and new.listing_id=old.listing_id and new.certificate_id=old.certificate_id then return new; end if;
 -- Revalidate the version returned by the row lock, not a second STABLE table
 -- lookup which could use the statement's older snapshot after a lock wait.
 select * into document from public.profile_certificates where id=new.certificate_id for share;
 evidence=private.valid_https_url(document.verification_url);
 if not evidence then
  perform 1 from storage.objects where bucket_id='certificates' and name=document.file_path for share;
  evidence=found;
 end if;
 if not private.listing_certificate_eligible(document,seller,evidence) then
  raise exception 'Listing credential unavailable' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.guard_listing_certificates() from public,anon,authenticated;
create trigger listing_certificates_guard before insert or update on public.listing_certificates
for each row execute function private.guard_listing_certificates();

-- Replace the old single-value guard through this new migration. This keeps
-- its existing trigger in place while preventing new writes to a second source.
create or replace function private.guard_listing_certificate() returns trigger
language plpgsql security definer set search_path='' as $$
declare seller uuid; service boolean;
begin
 select user_id into seller from public.profiles where id=new.seller_id;
 if current_setting('role',true)='authenticated' and
 (auth.uid() is distinct from seller or not private.is_member()) then
  raise exception 'Listing credential unavailable' using errcode='42501';
 end if;
 if current_setting('role',true)='authenticated' and new.certificate_id is not null then
  if tg_op='INSERT' then
   raise exception 'Legacy listing credential is read-only' using errcode='23514';
  elsif new.certificate_id is distinct from old.certificate_id then
   raise exception 'Legacy listing credential is read-only' using errcode='23514';
  end if;
 end if;
 if tg_op='UPDATE' and new.seller_id is distinct from old.seller_id and
 exists(select 1 from public.listing_certificates where listing_id=old.id) then
  raise exception 'Listing owner cannot change with credentials' using errcode='23514';
 end if;
 select is_service into service from public.categories where id=new.category_id;
 if service is false then
  if tg_op='UPDATE' then delete from public.listing_certificates where listing_id=old.id; end if;
  new.certificate_id=null;
 end if;
 return new;
end $$;

create function private.listing_credentials(target_listing uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'issuer',c.issuer,
 'issue_date',c.issue_date,'expiration_date',c.expiration_date) order by r.position),'[]'::jsonb)
 from public.listing_certificates r join public.listings l on l.id=r.listing_id
 join public.categories k on k.id=l.category_id join public.profiles p on p.id=l.seller_id
 join public.profile_certificates c on c.id=r.certificate_id
 where l.id=target_listing and k.is_service
 and private.profile_section_visible(p.id,'listings')
 and (l.status='active' or p.user_id=auth.uid())
 and private.listing_certificate_eligible(c.id,p.user_id);
$$;
revoke all on function private.listing_credentials(uuid) from public,anon;
grant execute on function private.listing_credentials(uuid) to authenticated;
create function public.listing_credentials(target_listing uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.listing_credentials(target_listing)$$;
revoke all on function public.listing_credentials(uuid) from public,anon;
grant execute on function public.listing_credentials(uuid) to authenticated;

-- Read-only compatibility for old consumers; never consult the legacy column.
create or replace function private.listing_credential(target_listing uuid) returns jsonb
language sql stable security definer set search_path='' as $$select private.listing_credentials(target_listing)->0$$;
comment on function public.listing_credential(uuid) is
 'Deprecated compatibility lookup: first currently eligible credential from listing_certificates. New callers use listing_credentials.';
