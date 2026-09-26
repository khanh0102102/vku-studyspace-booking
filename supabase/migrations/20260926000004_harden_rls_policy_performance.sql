-- VKU StudySpace — avoid repeated auth.uid() evaluation in RLS policies.

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own reservations" on public.reservations;
create policy "Users can read their own reservations"
  on public.reservations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
