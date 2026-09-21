-- Supabase's automatic RLS event trigger is an internal DDL helper.
-- Keep the trigger enabled, but remove execution rights from API clients.
-- Some local installations do not include this platform-provided function.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
