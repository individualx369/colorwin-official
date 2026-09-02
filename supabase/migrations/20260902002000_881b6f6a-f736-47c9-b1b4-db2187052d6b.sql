revoke all on function public.settle_transaction(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.request_withdrawal(uuid, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_gift_code(uuid, text) from public, anon, authenticated;
grant execute on function public.settle_transaction(uuid, text, text, text, text, text) to service_role;
grant execute on function public.request_withdrawal(uuid, numeric, text, jsonb) to service_role;
grant execute on function public.claim_gift_code(uuid, text) to service_role;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.current_profile_id() from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.current_profile_id() to authenticated, service_role;