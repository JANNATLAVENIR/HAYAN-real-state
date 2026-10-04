insert into public.admin_users (user_id, is_active)
select id, true
from auth.users
where lower(email) = lower('jannatlavenir@gmail.com')
on conflict (user_id) do update set is_active = true;

select au.user_id, au.is_active, u.email
from public.admin_users au
join auth.users u on u.id = au.user_id
where lower(u.email) = lower('jannatlavenir@gmail.com');
