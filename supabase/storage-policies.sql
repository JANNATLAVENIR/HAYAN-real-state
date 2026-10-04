insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users upload property images" on storage.objects;
drop policy if exists "Public property images are readable" on storage.objects;
drop policy if exists "Users delete their property images" on storage.objects;

create policy "Authenticated users upload property images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Public property images are readable"
  on storage.objects for select to public
  using (bucket_id = 'property-images');

create policy "Users delete their property images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
