create table private.certificate_file_cleanup (
 owner_id uuid not null references auth.users(id) on delete cascade,
 path text primary key,
 created_at timestamptz not null default now(),
 not_before timestamptz not null default now(),
 check(path ~ ('^'||owner_id::text||'/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|jpg|png)$'))
);
alter table private.certificate_file_cleanup enable row level security;
revoke all on private.certificate_file_cleanup from public,anon,authenticated;
create index certificate_cleanup_owner_idx on private.certificate_file_cleanup(owner_id,created_at);
create table public.profile_certificates (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 3 and 160),
 issuer text not null check(char_length(btrim(issuer)) between 2 and 160),
 issue_date date not null check(issue_date>=date '1900-01-01'),
 expiration_date date check(expiration_date>=issue_date),
 credential_id text check(char_length(credential_id)<=160),
 verification_url text check(verification_url ~ '^https://[^[:space:]]+$' and char_length(verification_url)<=2048),
 file_path text,
 status text not null default 'pending' check(status in ('pending','verified','rejected')),
 rejection_reason text check(char_length(rejection_reason)<=1000),
 verified_at timestamptz,
 verified_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(file_path is null or file_path ~ ('^'||user_id::text||'/'||id::text||'/[a-f0-9-]+\.(pdf|jpg|png)$')),
 check(status<>'rejected' or (rejection_reason is not null and char_length(btrim(rejection_reason))>0))
);
create index certificates_owner_idx on public.profile_certificates(user_id,created_at desc);
create index certificates_queue_idx on public.profile_certificates(status,created_at);
create index certificates_reviewer_idx on public.profile_certificates(verified_by);
alter table public.profile_certificates enable row level security;
revoke all on public.profile_certificates from public,anon,authenticated;
grant select,delete on public.profile_certificates to authenticated;
grant insert(id,user_id,title,issuer,issue_date,expiration_date,credential_id,verification_url,file_path) on public.profile_certificates to authenticated;
grant update(title,issuer,issue_date,expiration_date,credential_id,verification_url,file_path,status,rejection_reason,verified_at,verified_by) on public.profile_certificates to authenticated;
create policy certificates_read on public.profile_certificates for select to authenticated
using (((select private.is_member()) and user_id=(select auth.uid())) or (select private.is_admin()));
create policy certificates_insert on public.profile_certificates for insert to authenticated
with check ((select private.is_member()) and user_id=(select auth.uid()));
create policy certificates_update on public.profile_certificates for update to authenticated
using (((select private.is_member()) and user_id=(select auth.uid())) or (select private.is_admin()))
with check (((select private.is_member()) and user_id=(select auth.uid())) or (select private.is_admin()));
create policy certificates_delete on public.profile_certificates for delete to authenticated
using ((select private.is_member()) and user_id=(select auth.uid()));

create function private.guard_certificate_review() returns trigger
language plpgsql security invoker set search_path='' as $$
declare content_changed boolean;
begin
 content_changed := row(new.title,new.issuer,new.issue_date,new.expiration_date,new.credential_id,new.verification_url,new.file_path)
   is distinct from row(old.title,old.issuer,old.issue_date,old.expiration_date,old.credential_id,old.verification_url,old.file_path);
 if content_changed then
   if new.user_id<>auth.uid() or not private.is_member() then raise exception 'Only owner can edit certificate'; end if;
   new.status:='pending';new.rejection_reason:=null;new.verified_at:=null;new.verified_by:=null;
 elsif row(new.status,new.rejection_reason,new.verified_at,new.verified_by) is distinct from row(old.status,old.rejection_reason,old.verified_at,old.verified_by) then
   if not private.is_admin() then raise exception 'Administrator review required' using errcode='42501'; end if;
   if new.status not in ('verified','rejected') then raise exception 'Invalid review'; end if;
   new.verified_at:=now();new.verified_by:=auth.uid();
   if new.status='verified' then new.rejection_reason:=null; end if;
 end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.guard_certificate_review() from public,anon,authenticated;
create trigger certificates_review before update on public.profile_certificates for each row execute function private.guard_certificate_review();

-- Only reviewed metadata leaves this privileged lookup. No path/reviewer IDs.
create function private.visible_certificates(target_profile uuid)
returns table(id uuid,title text,issuer text,issue_date date,expiration_date date,credential_id text,verification_url text)
language sql stable security definer set search_path='' as $$
 select c.id,c.title,c.issuer,c.issue_date,c.expiration_date,c.credential_id,c.verification_url
 from public.profile_certificates c join public.profiles p on p.user_id=c.user_id
 where p.id=target_profile and c.status='verified' and private.is_member() and private.is_active_student(p.user_id);
$$;
revoke all on function private.visible_certificates(uuid) from public,anon;
grant execute on function private.visible_certificates(uuid) to authenticated;
create function public.visible_certificates(target_profile uuid)
returns table(id uuid,title text,issuer text,issue_date date,expiration_date date,credential_id text,verification_url text)
language sql stable security invoker set search_path='' as $$select * from private.visible_certificates(target_profile)$$;
revoke all on function public.visible_certificates(uuid) from public,anon;
grant execute on function public.visible_certificates(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('certificates','certificates',false,4194304,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy certificates_file_read on storage.objects for select to authenticated using (
 bucket_id='certificates' and (
 ((select private.is_member()) and (storage.foldername(name))[1]=(select auth.uid())::text)
 or ((select private.is_admin()) and exists(select 1 from public.profile_certificates c where c.file_path=name))
 ));
create policy certificates_file_insert on storage.objects for insert to authenticated with check (
 bucket_id='certificates' and (select private.is_member()) and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ ('^'||(select auth.uid())::text||'/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|jpg|png)$'));
create policy certificates_file_delete on storage.objects for delete to authenticated using (
 bucket_id='certificates' and (select private.is_member()) and (storage.foldername(name))[1]=(select auth.uid())::text);
