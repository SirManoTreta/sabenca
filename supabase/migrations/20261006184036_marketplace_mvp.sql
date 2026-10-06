-- Extend the existing catalog; no duplicated tables or public buckets.
alter table public.categories add column is_service boolean not null default false;
update public.categories set is_service=true where name in ('Serviços','Aulas particulares','Freelance');

create function private.validate_listing_kind() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare service boolean;
begin
 select is_service into service from public.categories where id=new.category_id;
 if service is null or service <> (new.condition='not_applicable') then
  raise exception 'Listing condition does not match category' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function private.validate_listing_kind() from public,anon,authenticated;
create trigger listing_kind before insert or update of category_id,condition on public.listings
for each row execute function private.validate_listing_kind();

alter table public.listing_images add constraint listing_images_mvp_position check (position between 0 and 4);
-- Reorder positions atomically without transient unique conflicts.
alter table public.listing_images drop constraint listing_images_listing_id_position_key;
alter table public.listing_images add constraint listing_images_listing_id_position_key unique (listing_id,position) deferrable initially immediate;
create function private.validate_listing_image_path() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare seller uuid;
begin
 select p.user_id into seller from public.listings l join public.profiles p on p.id=l.seller_id where l.id=new.listing_id for update of l;
 if seller is null or new.image_url !~ ('^'||seller::text||'/'||new.listing_id::text||'/[a-f0-9-]{36}[.](jpg|png|webp)$') then
  raise exception 'Invalid listing image path' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function private.validate_listing_image_path() from public,anon,authenticated;
create trigger listing_image_path before insert or update of listing_id,image_url on public.listing_images
for each row execute function private.validate_listing_image_path();

-- Also prevent an owner-folder upload from targeting somebody else's listing.
drop policy sabenca_images_insert on storage.objects;
create policy sabenca_images_insert on storage.objects for insert to authenticated with check (
 (select private.is_member()) and bucket_id in ('avatars','project-images','listing-images')
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and (bucket_id<>'listing-images' or exists (
  select 1 from public.listings l join public.profiles p on p.id=l.seller_id
  where l.id::text=(storage.foldername(objects.name))[2] and p.user_id=(select auth.uid())
 ))
);
drop policy sabenca_images_update on storage.objects;
create policy sabenca_images_update on storage.objects for update to authenticated using (
 (select private.is_member()) and bucket_id in ('avatars','project-images','listing-images')
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and (bucket_id<>'listing-images' or exists (
  select 1 from public.listings l join public.profiles p on p.id=l.seller_id
  where l.id::text=(storage.foldername(objects.name))[2] and p.user_id=(select auth.uid())
 ))
) with check (
 (select private.is_member()) and bucket_id in ('avatars','project-images','listing-images')
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and (bucket_id<>'listing-images' or exists (
  select 1 from public.listings l join public.profiles p on p.id=l.seller_id
  where l.id::text=(storage.foldername(objects.name))[2] and p.user_id=(select auth.uid())
 ))
);
