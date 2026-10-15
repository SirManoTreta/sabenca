-- Blocks are directional to manage, bilateral for every social read.
create table public.user_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create index user_blocks_reverse_idx on public.user_blocks(blocked_id,blocker_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public,anon,authenticated;
grant select,delete on public.user_blocks to authenticated;
grant insert(blocker_id,blocked_id) on public.user_blocks to authenticated;
create policy blocks_read on public.user_blocks for select to authenticated using ((select private.is_member()) and blocker_id=(select auth.uid()));
create policy blocks_insert on public.user_blocks for insert to authenticated with check ((select private.is_member()) and blocker_id=(select auth.uid()) and private.is_active_student(blocked_id));
create policy blocks_delete on public.user_blocks for delete to authenticated using ((select private.is_member()) and blocker_id=(select auth.uid()));
create function private.socially_visible(target_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_member() and private.is_active_student(target_user) and not exists(
 select 1 from public.user_blocks b where (b.blocker_id=auth.uid() and b.blocked_id=target_user) or (b.blocked_id=auth.uid() and b.blocker_id=target_user));
$$;
revoke all on function private.socially_visible(uuid) from public,anon;
grant execute on function private.socially_visible(uuid) to authenticated;
create policy profiles_social_boundary on public.profiles as restrictive for select to authenticated using (private.socially_visible(user_id));
create function private.clean_blocked_connections() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.blocker_id<>auth.uid() or not private.is_member() then raise exception 'Unauthorized block';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(new.blocker_id,new.blocked_id)::text||greatest(new.blocker_id,new.blocked_id)::text,0));
 delete from public.connections c using public.profiles a,public.profiles b
 where a.user_id=new.blocker_id and b.user_id=new.blocked_id
 and ((c.requester_id=a.id and c.receiver_id=b.id) or (c.requester_id=b.id and c.receiver_id=a.id));
 return new;
end $$;
revoke all on function private.clean_blocked_connections() from public,anon,authenticated;
create trigger blocks_remove_connections after insert on public.user_blocks for each row execute function private.clean_blocked_connections();
create function private.guard_connection_block() returns trigger
language plpgsql security definer set search_path='' as $$
declare a uuid;b uuid;
begin
 select user_id into a from public.profiles where id=new.requester_id;
 select user_id into b from public.profiles where id=new.receiver_id;
 perform pg_advisory_xact_lock(hashtextextended(least(a,b)::text||greatest(a,b)::text,0));
 if exists(select 1 from public.user_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a)) then raise exception 'Connection blocked' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.guard_connection_block() from public,anon,authenticated;
create trigger connections_block_guard before insert or update on public.connections for each row execute function private.guard_connection_block();

create table public.profile_privacy (
 user_id uuid primary key references auth.users(id) on delete cascade,
 show_semester boolean not null default true,
 show_bio boolean not null default true,
 show_skills boolean not null default true,
 show_interests boolean not null default true,
 show_projects boolean not null default true,
 show_listings boolean not null default true
);
alter table public.profile_privacy enable row level security;
revoke all on public.profile_privacy from public,anon,authenticated;
grant select on public.profile_privacy to authenticated;
grant insert(user_id,show_semester,show_bio,show_skills,show_interests,show_projects,show_listings) on public.profile_privacy to authenticated;
grant update(show_semester,show_bio,show_skills,show_interests,show_projects,show_listings) on public.profile_privacy to authenticated;
create policy privacy_own on public.profile_privacy for all to authenticated using ((select private.is_member()) and user_id=(select auth.uid())) with check ((select private.is_member()) and user_id=(select auth.uid()));
create function private.profile_section_visible(target_profile uuid, section text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.profile_privacy v on v.user_id=p.user_id where p.id=target_profile
 and private.socially_visible(p.user_id) and (p.user_id=auth.uid() or coalesce(case section
 when 'skills' then v.show_skills when 'interests' then v.show_interests when 'projects' then v.show_projects when 'listings' then v.show_listings when 'semester' then v.show_semester when 'bio' then v.show_bio else false end,true)));
$$;
revoke all on function private.profile_section_visible(uuid,text) from public,anon;
grant execute on function private.profile_section_visible(uuid,text) to authenticated;
create policy skills_privacy on public.profile_skills as restrictive for select to authenticated using (private.profile_section_visible(profile_id,'skills'));
create policy interests_privacy on public.profile_interests as restrictive for select to authenticated using (private.profile_section_visible(profile_id,'interests'));
create policy projects_privacy on public.projects as restrictive for select to authenticated using (private.profile_section_visible(profile_id,'projects'));
create policy listings_privacy on public.listings as restrictive for select to authenticated using (private.profile_section_visible(seller_id,'listings'));

-- Raw optional fields cannot be selected through the Data API. Safe lookups
-- expose their value only to the owner or according to the visibility setting.
revoke select on public.profiles from authenticated;
grant select(id,user_id,username,name,course,course_id,institution,institution_id,avatar_url,created_at,updated_at) on public.profiles to authenticated;
create function private.visible_semester(target_profile uuid) returns smallint
language sql stable security definer set search_path='' as $$select semester from public.profiles where id=target_profile and private.profile_section_visible(id,'semester')$$;
revoke all on function private.visible_semester(uuid) from public,anon;
grant execute on function private.visible_semester(uuid) to authenticated;
create function private.social_profile(target_username text,target_profile uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'username',p.username,'name',p.name,'bio',case when private.profile_section_visible(p.id,'bio') then p.bio end,
 'courses',jsonb_build_object('name',c.name),'semester',private.visible_semester(p.id),'institution',p.institution,'avatar_url',p.avatar_url)
 from public.profiles p left join public.courses c on c.id=p.course_id
 where private.socially_visible(p.user_id) and (case when target_profile is not null then p.id=target_profile when target_username is not null then p.username=lower(target_username) else p.user_id=auth.uid() end);
$$;
revoke all on function private.social_profile(text,uuid) from public,anon;
grant execute on function private.social_profile(text,uuid) to authenticated;
create function public.social_profile(target_username text default null,target_profile uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.social_profile(target_username,target_profile)$$;
revoke all on function public.social_profile(text,uuid) from public,anon;
grant execute on function public.social_profile(text,uuid) to authenticated;

-- Storage follows the same boundary; already-issued URLs expire within 5 minutes.
create policy social_images_boundary on storage.objects as restrictive for select to authenticated using (
 bucket_id not in ('avatars','project-images','listing-images') or exists(select 1 from public.profiles p where p.user_id::text=(storage.foldername(objects.name))[1]
 and private.socially_visible(p.user_id)
 and (bucket_id='avatars' or (bucket_id='project-images' and private.profile_section_visible(p.id,'projects')) or (bucket_id='listing-images' and private.profile_section_visible(p.id,'listings')))));
create or replace function private.visible_certificates(target_profile uuid)
returns table(id uuid,title text,issuer text,issue_date date,expiration_date date,credential_id text,verification_url text)
language sql stable security definer set search_path='' as $$
 select c.id,c.title,c.issuer,c.issue_date,c.expiration_date,c.credential_id,c.verification_url
 from public.profile_certificates c join public.profiles p on p.user_id=c.user_id
 where p.id=target_profile and c.status='verified' and private.socially_visible(p.user_id);
$$;

create table public.reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 target_type text not null check(target_type in ('profile','listing')),
 target_id uuid not null,
 reason text not null check(reason in ('harassment','fraud','inappropriate','privacy','other')),
 details text check(char_length(details)<=2000),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed','actioned')),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(reporter_id,target_type,target_id)
);
create index reports_queue_idx on public.reports(status,created_at);
create index reports_reviewer_idx on public.reports(reviewed_by);
alter table public.reports enable row level security;
revoke all on public.reports from public,anon,authenticated;
grant select on public.reports to authenticated;
grant insert(reporter_id,target_type,target_id,reason,details) on public.reports to authenticated;
grant update(status,reviewed_by,reviewed_at) on public.reports to authenticated;
create policy reports_read on public.reports for select to authenticated using (((select private.is_member()) and reporter_id=(select auth.uid())) or (select private.is_admin()));
create policy reports_insert on public.reports for insert to authenticated with check ((select private.is_member()) and reporter_id=(select auth.uid()) and (
 (target_type='profile' and exists(select 1 from public.profiles p where p.id=target_id and p.user_id<>(select auth.uid()))) or
 (target_type='listing' and exists(select 1 from public.listings l join public.profiles p on p.id=l.seller_id where l.id=target_id and p.user_id<>(select auth.uid())))));
create policy reports_review on public.reports for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()) and reviewed_by=(select auth.uid()) and reviewed_at is not null and status<>'pending');
create function private.guard_report_rate() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.reporter_id::text,72619411));
 if (select count(*) from public.reports where reporter_id=new.reporter_id and created_at>now()-interval '1 hour')>=10 then
 raise exception 'Report rate limit reached' using errcode='23514';end if;
 return new;
end $$;
revoke all on function private.guard_report_rate() from public,anon,authenticated;
create trigger reports_rate_limit before insert on public.reports for each row execute function private.guard_report_rate();
