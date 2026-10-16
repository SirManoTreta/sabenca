-- A BEFORE trigger runs before RLS WITH CHECK. Do not let a third party probe
-- whether an arbitrary pair is blocked through different trigger errors.
create or replace function private.guard_connection_block() returns trigger
language plpgsql security definer set search_path='' as $$
declare a uuid;b uuid;
begin
 select user_id into a from public.profiles where id=new.requester_id;
 select user_id into b from public.profiles where id=new.receiver_id;
 if current_setting('role',true)='authenticated' and (
   auth.uid() is null or not private.is_member()
   or (auth.uid() is distinct from a and auth.uid() is distinct from b)
 ) then raise exception 'Connection authorization required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(a,b)::text||greatest(a,b)::text,0));
 if exists(select 1 from public.user_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a)) then raise exception 'Connection blocked' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.guard_connection_block() from public,anon,authenticated;

-- Reviewers' Auth UUIDs are internal administrative data, not social metadata.
revoke select on public.profile_certificates,public.reports from authenticated;
grant select(id,user_id,title,issuer,issue_date,expiration_date,credential_id,verification_url,file_path,status,rejection_reason,verified_at,created_at,updated_at)
 on public.profile_certificates to authenticated;
grant select(id,reporter_id,target_type,target_id,reason,details,status,reviewed_at,created_at)
 on public.reports to authenticated;
create index admin_invitations_provisioned_user_idx on private.admin_invitations(provisioned_user_id);
