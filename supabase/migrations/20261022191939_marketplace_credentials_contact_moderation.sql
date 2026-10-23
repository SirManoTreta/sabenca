-- Additive TCC completion. Existing certificate review, membership and privacy remain authoritative.
create function private.valid_https_url(value text) returns boolean
language sql immutable set search_path='' as $$
 select value is not null and char_length(value)<=2048
 and value ~ '^https://[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$';
$$;
revoke all on function private.valid_https_url(text) from public,anon;
grant execute on function private.valid_https_url(text) to authenticated;

create function private.certificate_has_evidence(document_path text, source_url text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.valid_https_url(source_url) or exists(
 select 1 from storage.objects where bucket_id='certificates' and name=document_path);
$$;
revoke all on function private.certificate_has_evidence(text,text) from public,anon,authenticated;

-- AFTER runs after the existing BEFORE trigger has reset edited documents to pending.
create function private.require_certificate_evidence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='verified' and not private.certificate_has_evidence(new.file_path,new.verification_url) then
  raise exception 'Certificate evidence required' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.require_certificate_evidence() from public,anon,authenticated;
create trigger certificates_evidence after insert or update on public.profile_certificates
for each row execute function private.require_certificate_evidence();

-- Expired documents remain historical metadata; the UI labels them as expired.
create or replace function private.visible_certificates(target_profile uuid)
returns table(id uuid,title text,issuer text,issue_date date,expiration_date date,credential_id text,verification_url text)
language sql stable security definer set search_path='' as $$
 select c.id,c.title,c.issuer,c.issue_date,c.expiration_date,c.credential_id,c.verification_url
 from public.profile_certificates c join public.profiles p on p.user_id=c.user_id
 where p.id=target_profile and c.status='verified' and private.socially_visible(p.user_id)
 and c.issue_date<=(now() at time zone 'America/Sao_Paulo')::date
 and private.certificate_has_evidence(c.file_path,c.verification_url);
$$;

alter table public.listings add column certificate_id uuid references public.profile_certificates(id) on delete set null;
create index listings_certificate_idx on public.listings(certificate_id) where certificate_id is not null;
grant insert(certificate_id),update(certificate_id) on public.listings to authenticated;

create function private.guard_listing_certificate() returns trigger
language plpgsql security definer set search_path='' as $$
declare seller uuid; document public.profile_certificates; service boolean;
begin
 if new.certificate_id is null then return new; end if;
 select p.user_id into seller from public.profiles p where p.id=new.seller_id;
 if current_setting('role',true)='authenticated' and
 (auth.uid() is distinct from seller or not private.is_member()) then
  raise exception 'Listing credential unavailable' using errcode='42501';
 end if;
 select is_service into service from public.categories where id=new.category_id;
 if service is distinct from true then
  raise exception 'Only services accept credentials' using errcode='23514';
 end if;
 -- An invalidated association may remain as history, but is never displayed as valid.
 if tg_op='UPDATE' and new.certificate_id=old.certificate_id and new.seller_id=old.seller_id then return new; end if;
 select * into document from public.profile_certificates where id=new.certificate_id for share;
 if document.id is null or document.user_id<>seller or document.status<>'verified'
 or document.issue_date>(now() at time zone 'America/Sao_Paulo')::date
 or document.expiration_date<(now() at time zone 'America/Sao_Paulo')::date
 or not private.certificate_has_evidence(document.file_path,document.verification_url) then
  raise exception 'Listing credential unavailable' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.guard_listing_certificate() from public,anon,authenticated;
create trigger listing_certificate before insert or update of certificate_id,category_id,seller_id on public.listings
for each row execute function private.guard_listing_certificate();

-- Only approved, current, evidenced metadata. Originals and reviewer IDs never leave this lookup.
create function private.listing_credential(target_listing uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'title',c.title,'issuer',c.issuer,'issue_date',c.issue_date,'expiration_date',c.expiration_date)
 from public.listings l join public.categories k on k.id=l.category_id
 join public.profiles p on p.id=l.seller_id
 join public.profile_certificates c on c.id=l.certificate_id and c.user_id=p.user_id
 where l.id=target_listing and k.is_service and c.status='verified'
 and c.issue_date<=(now() at time zone 'America/Sao_Paulo')::date
 and (c.expiration_date is null or c.expiration_date>=(now() at time zone 'America/Sao_Paulo')::date)
 and private.certificate_has_evidence(c.file_path,c.verification_url)
 and private.profile_section_visible(p.id,'listings')
 and (l.status='active' or p.user_id=auth.uid());
$$;
revoke all on function private.listing_credential(uuid) from public,anon;
grant execute on function private.listing_credential(uuid) to authenticated;
create function public.listing_credential(target_listing uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.listing_credential(target_listing)$$;
revoke all on function public.listing_credential(uuid) from public,anon;
grant execute on function public.listing_credential(uuid) to authenticated;

create table public.marketplace_contacts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 url text check(url is null or private.valid_https_url(url)),
 enabled boolean not null default false,
 check(not enabled or url is not null)
);
alter table public.marketplace_contacts enable row level security;
revoke all on public.marketplace_contacts from public,anon,authenticated;
grant select,delete on public.marketplace_contacts to authenticated;
grant insert(user_id,url,enabled),update(url,enabled) on public.marketplace_contacts to authenticated;
create policy contact_owner on public.marketplace_contacts for all to authenticated
using ((select private.is_member()) and user_id=(select auth.uid()))
with check ((select private.is_member()) and user_id=(select auth.uid()));
create function private.marketplace_contact(target_profile uuid) returns text
language sql stable security definer set search_path='' as $$
 select c.url from public.marketplace_contacts c join public.profiles p on p.user_id=c.user_id
 where p.id=target_profile and c.enabled and private.profile_section_visible(p.id,'listings');
$$;
revoke all on function private.marketplace_contact(uuid) from public,anon;
grant execute on function private.marketplace_contact(uuid) to authenticated;
create function public.marketplace_contact(target_profile uuid) returns text
language sql stable security invoker set search_path='' as $$select private.marketplace_contact(target_profile)$$;
revoke all on function public.marketplace_contact(uuid) from public,anon;
grant execute on function public.marketplace_contact(uuid) to authenticated;

-- Administrative hold prevents an owner from immediately republishing reported content.
create table private.listing_moderation (
 listing_id uuid primary key references public.listings(id) on delete cascade,
 report_id uuid references public.reports(id) on delete set null,
 moderated_by uuid references auth.users(id) on delete set null,
 moderated_at timestamptz not null default now()
);
alter table private.listing_moderation enable row level security;
revoke all on private.listing_moderation from public,anon,authenticated;
create index listing_moderation_report_idx on private.listing_moderation(report_id);
create index listing_moderation_admin_idx on private.listing_moderation(moderated_by);
create function private.guard_moderated_listing() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'inactive' and exists(select 1 from private.listing_moderation where listing_id=new.id) then
  raise exception 'Listing disabled by moderation' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.guard_moderated_listing() from public,anon,authenticated;
create trigger listing_moderation_hold before update on public.listings
for each row execute function private.guard_moderated_listing();
create function private.deactivate_report_listing(target_report uuid) returns void
language plpgsql security definer set search_path='' as $$
declare report public.reports; target uuid;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into report from public.reports where id=target_report for update;
 if report.id is null or report.target_type<>'listing' then raise exception 'Listing report unavailable'; end if;
 select l.id into target from public.listings l join public.profiles p on p.id=l.seller_id
 where l.id=report.target_id and p.institution_id='fatece' for update of l;
 if target is null then raise exception 'Listing report unavailable'; end if;
 insert into private.listing_moderation(listing_id,report_id,moderated_by) values(target,report.id,auth.uid()) on conflict do nothing;
 update public.listings set status='inactive' where id=target;
 update public.reports set status='actioned',reviewed_by=auth.uid(),reviewed_at=now() where id=report.id;
end $$;
revoke all on function private.deactivate_report_listing(uuid) from public,anon;
grant execute on function private.deactivate_report_listing(uuid) to authenticated;
create function public.deactivate_report_listing(target_report uuid) returns void
language sql security invoker set search_path='' as $$select private.deactivate_report_listing(target_report)$$;
revoke all on function public.deactivate_report_listing(uuid) from public,anon;
grant execute on function public.deactivate_report_listing(uuid) to authenticated;
