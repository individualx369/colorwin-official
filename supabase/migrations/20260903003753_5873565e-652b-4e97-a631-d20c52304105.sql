revoke insert, update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.transactions from authenticated;
revoke insert, update, delete on public.support_tickets from authenticated;
revoke insert, update, delete on public.ticket_messages from authenticated;
drop policy if exists "own profile update" on public.profiles;