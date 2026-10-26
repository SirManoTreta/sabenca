-- Student cannot replace a previously reviewed original by deleting and uploading
-- different bytes under the same path. A metadata edit first resets review to pending.
-- The existing absence of UPDATE policies already forbids overwriting certificates.
create policy certificates_reviewed_path_immutable on storage.objects
as restrictive for insert to authenticated with check (
 bucket_id<>'certificates' or not exists(
  select 1 from public.profile_certificates c
  where c.file_path=objects.name and c.status='verified'
 )
);
