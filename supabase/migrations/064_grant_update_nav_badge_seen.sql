-- Ensure authenticated clients can clear sidebar badges (some projects revoke default EXECUTE).
grant execute on function public.update_nav_badge_seen(text) to authenticated;
