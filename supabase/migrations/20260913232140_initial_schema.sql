-- SABENÇA: foundation schema. Personal email allowed by user decision, 2026-09-13.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Only this internal helper can read auth.users. Never trust editable JWT metadata.
create function private.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and email_confirmed_at is not null
      and coalesce(is_anonymous, false) = false
      and (banned_until is null or banned_until < now())
  );
$$;
revoke all on function private.is_member() from public, anon;
grant execute on function private.is_member() to authenticated;

create function private.touch_updated_at() returns trigger
language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;
revoke all on function private.touch_updated_at() from public;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  bio text check (char_length(bio) <= 1000),
  course text check (char_length(course) <= 120),
  semester smallint check (semester between 1 and 30),
  institution text check (char_length(institution) <= 160),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.avatar_url is 'Private Storage object path, not a public URL. Generate signed URLs after authorization.';

create table public.skills (id uuid primary key default gen_random_uuid(), name text not null unique check (char_length(name) between 1 and 60));
create table public.interests (id uuid primary key default gen_random_uuid(), name text not null unique check (char_length(name) between 1 and 80));
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  unique (profile_id, skill_id)
);
create table public.profile_interests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete restrict,
  unique (profile_id, interest_id)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(description) between 1 and 5000),
  image_url text,
  project_url text check (project_url ~ '^https?://[^[:space:]]+$'),
  repository_url text check (repository_url ~ '^https?://[^[:space:]]+$'),
  created_at timestamptz not null default now()
);
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(description) between 1 and 5000),
  price numeric(12,2) not null check (price >= 0 and price < 10000000000),
  category_id uuid not null references public.categories(id),
  condition text not null check (condition in ('new', 'like_new', 'used', 'not_applicable')),
  status text not null default 'active' check (status in ('active', 'sold', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  image_url text not null,
  position smallint not null default 0 check (position between 0 and 9),
  unique (listing_id, position)
);
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> receiver_id)
);
create unique index connections_pair_idx on public.connections (least(requester_id, receiver_id), greatest(requester_id, receiver_id));
create index connections_requester_idx on public.connections (requester_id, status);
create index connections_receiver_idx on public.connections (receiver_id, status);
create index profiles_course_semester_idx on public.profiles (course, semester);
create index profile_skills_skill_idx on public.profile_skills (skill_id);
create index profile_interests_interest_idx on public.profile_interests (interest_id);
create index projects_profile_idx on public.projects (profile_id, created_at desc);
create index listings_seller_idx on public.listings (seller_id);
create index listings_category_idx on public.listings (category_id, status);
create index listings_active_created_idx on public.listings (created_at desc) where status = 'active';

create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated_at();
create trigger listings_updated before update on public.listings for each row execute function private.touch_updated_at();
create trigger connections_updated before update on public.connections for each row execute function private.touch_updated_at();

-- Explicit grants, also on installations with legacy default grants.
revoke all on public.profiles, public.skills, public.interests, public.categories, public.profile_skills,
 public.profile_interests, public.projects, public.listings, public.listing_images, public.connections from anon, authenticated;
grant select on public.skills, public.interests, public.categories to authenticated;
grant select, insert, delete on public.profiles, public.profile_skills, public.profile_interests,
 public.projects, public.listings, public.listing_images, public.connections to authenticated;
-- Column privileges keep ownership and connection endpoints immutable.
grant update (username, name, bio, course, semester, institution, avatar_url) on public.profiles to authenticated;
grant update (title, description, image_url, project_url, repository_url) on public.projects to authenticated;
grant update (title, description, price, category_id, condition, status) on public.listings to authenticated;
grant update (image_url, position) on public.listing_images to authenticated;
grant update (status) on public.connections to authenticated;

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.interests enable row level security;
alter table public.categories enable row level security;
alter table public.profile_skills enable row level security;
alter table public.profile_interests enable row level security;
alter table public.projects enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.connections enable row level security;
create policy members_read on public.profiles for select to authenticated using ((select private.is_member()));
create policy members_read on public.skills for select to authenticated using ((select private.is_member()));
create policy members_read on public.interests for select to authenticated using ((select private.is_member()));
create policy members_read on public.categories for select to authenticated using ((select private.is_member()));
create policy members_read on public.profile_skills for select to authenticated using ((select private.is_member()));
create policy members_read on public.profile_interests for select to authenticated using ((select private.is_member()));
create policy members_read on public.projects for select to authenticated using ((select private.is_member()));

create policy profiles_insert on public.profiles for insert to authenticated
with check ((select private.is_member()) and user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
using ((select private.is_member()) and user_id = (select auth.uid()))
with check ((select private.is_member()) and user_id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated
using ((select private.is_member()) and user_id = (select auth.uid()));
create policy owner_insert on public.profile_skills for insert to authenticated with check ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy owner_delete on public.profile_skills for delete to authenticated using ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy owner_insert on public.profile_interests for insert to authenticated with check ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy owner_delete on public.profile_interests for delete to authenticated using ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy owner_insert on public.projects for insert to authenticated with check ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy owner_update on public.projects for update to authenticated using ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()))) with check ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));
create policy owner_delete on public.projects for delete to authenticated using ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid())));

create policy listings_read on public.listings for select to authenticated
using ((select private.is_member()) and (status = 'active' or exists (select 1 from public.profiles p where p.id = seller_id and p.user_id = (select auth.uid()))));
create policy owner_insert on public.listings for insert to authenticated with check ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = seller_id and p.user_id = (select auth.uid())));
create policy owner_update on public.listings for update to authenticated using ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = seller_id and p.user_id = (select auth.uid()))) with check ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = seller_id and p.user_id = (select auth.uid())));
create policy owner_delete on public.listings for delete to authenticated using ((select private.is_member()) and exists (select 1 from public.profiles p where p.id = seller_id and p.user_id = (select auth.uid())));
create policy owner_insert on public.listing_images for insert to authenticated with check ((select private.is_member()) and exists (select 1 from public.listings l join public.profiles p on p.id = l.seller_id where l.id = listing_id and p.user_id = (select auth.uid())));
create policy owner_update on public.listing_images for update to authenticated using ((select private.is_member()) and exists (select 1 from public.listings l join public.profiles p on p.id = l.seller_id where l.id = listing_id and p.user_id = (select auth.uid()))) with check ((select private.is_member()) and exists (select 1 from public.listings l join public.profiles p on p.id = l.seller_id where l.id = listing_id and p.user_id = (select auth.uid())));
create policy owner_delete on public.listing_images for delete to authenticated using ((select private.is_member()) and exists (select 1 from public.listings l join public.profiles p on p.id = l.seller_id where l.id = listing_id and p.user_id = (select auth.uid())));

create policy images_read on public.listing_images for select to authenticated
using ((select private.is_member()) and exists (select 1 from public.listings l where l.id = listing_id));
create policy connections_read on public.connections for select to authenticated
using ((select private.is_member()) and exists (select 1 from public.profiles p where p.id in (requester_id, receiver_id) and p.user_id = (select auth.uid())));
create policy connections_request on public.connections for insert to authenticated
with check ((select private.is_member()) and status = 'pending'
 and exists (select 1 from public.profiles p where p.id = requester_id and p.user_id = (select auth.uid())));
create policy connections_respond on public.connections for update to authenticated
using ((select private.is_member()) and status = 'pending'
 and exists (select 1 from public.profiles p where p.id = receiver_id and p.user_id = (select auth.uid())))
with check ((select private.is_member()) and status in ('accepted', 'rejected')
 and exists (select 1 from public.profiles p where p.id = receiver_id and p.user_id = (select auth.uid())));
create policy connections_delete on public.connections for delete to authenticated
using ((select private.is_member()) and exists (select 1 from public.profiles p where p.id in (requester_id, receiver_id) and p.user_id = (select auth.uid())));

insert into public.categories (name) values ('Livros'), ('Materiais acadêmicos'), ('Eletrônicos'), ('Informática'), ('Serviços'), ('Aulas particulares'), ('Freelance'), ('Outros');
insert into public.skills (name) values ('React'), ('TypeScript'), ('Java'), ('Python'), ('Photoshop'), ('Edição de vídeo'), ('Redes'), ('Banco de dados');
insert into public.interests (name) values ('Desenvolvimento Web'), ('Jogos'), ('Inteligência Artificial'), ('Cibersegurança'), ('Design'), ('Empreendedorismo');

-- Private buckets. Files use <auth-user-uuid>/<resource-uuid>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp']),
 ('listing-images', 'listing-images', false, 5242880, array['image/jpeg','image/png','image/webp']),
 ('project-images', 'project-images', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy sabenca_images_read on storage.objects for select to authenticated
using ((select private.is_member()) and (
 bucket_id in ('avatars', 'project-images') or
 (bucket_id = 'listing-images' and (
  (storage.foldername(name))[1] = (select auth.uid())::text or
  exists (select 1 from public.listings l where l.id::text = (storage.foldername(name))[2])
 ))
));
create policy sabenca_images_insert on storage.objects for insert to authenticated
with check ((select private.is_member()) and bucket_id in ('avatars', 'listing-images', 'project-images')
 and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy sabenca_images_update on storage.objects for update to authenticated
using ((select private.is_member()) and bucket_id in ('avatars', 'listing-images', 'project-images')
 and (storage.foldername(name))[1] = (select auth.uid())::text)
with check ((select private.is_member()) and bucket_id in ('avatars', 'listing-images', 'project-images')
 and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy sabenca_images_delete on storage.objects for delete to authenticated
using ((select private.is_member()) and bucket_id in ('avatars', 'listing-images', 'project-images')
 and (storage.foldername(name))[1] = (select auth.uid())::text);
