-- Keep the existing 50 MiB storage ceiling and allow the image formats used
-- by property, profile, and brand image uploads. Enforced by Storage itself.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'property-images') then
    raise exception 'Expected property-images bucket to exist before hardening it';
  end if;
end;
$$;

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
where id = 'property-images';
