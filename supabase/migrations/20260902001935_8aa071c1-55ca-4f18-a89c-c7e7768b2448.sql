create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  phone text not null unique,
  display_name text not null default '',
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('deposit','withdraw')),
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'UPI',
  utr text,
  bank jsonb,
  purpose text check (purpose in ('security')),
  status text not null default 'pending' check (status in ('pending','processing','approved','rejected')),
  gateway_provider text,
  gateway_ref text,
  gateway_message text,
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index transactions_profile_idx on public.transactions (profile_id, created_at desc);
create unique index transactions_utr_idx on public.transactions (utr) where utr is not null;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default 'Official Support',
  status text not null default 'open' check (status in ('open','closed')),
  unread_for_admin int not null default 0,
  unread_for_user int not null default 0,
  telegram_chat_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender text not null check (sender in ('user','admin','system')),
  body text not null,
  telegram_message_id text,
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

create table public.gift_codes (
  code text primary key,
  amount numeric(12,2) not null check (amount > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.gift_claims (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.gift_codes(code) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  unique (code, profile_id)
);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.support_tickets to authenticated;
grant select, insert, update, delete on public.ticket_messages to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.gift_codes to authenticated;
grant select on public.gift_claims to authenticated;
grant all on public.profiles, public.user_roles, public.transactions, public.support_tickets,
  public.ticket_messages, public.gift_codes, public.gift_claims to service_role;
grant select on public.gift_codes to anon;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.transactions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.gift_codes enable row level security;
alter table public.gift_claims enable row level security;

create policy "own profile read" on public.profiles for select to authenticated
  using (auth_user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy "roles self read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "own transactions read" on public.transactions for select to authenticated
  using (profile_id = public.current_profile_id() or public.has_role(auth.uid(),'admin'));

create policy "own tickets read" on public.support_tickets for select to authenticated
  using (profile_id = public.current_profile_id() or public.has_role(auth.uid(),'admin'));

create policy "own ticket messages read" on public.ticket_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id
    and (t.profile_id = public.current_profile_id() or public.has_role(auth.uid(),'admin'))));

create policy "gift codes read" on public.gift_codes for select to anon, authenticated using (true);
create policy "own claims read" on public.gift_claims for select to authenticated
  using (profile_id = public.current_profile_id() or public.has_role(auth.uid(),'admin'));

create or replace function public.settle_transaction(_tx_id uuid, _status text, _note text default null,
  _provider text default null, _ref text default null, _message text default null)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare tx public.transactions;
begin
  select * into tx from public.transactions where id = _tx_id for update;
  if tx is null then raise exception 'transaction not found'; end if;
  if tx.status in ('approved','rejected') then return tx; end if;

  if tx.kind = 'deposit' and _status = 'approved' then
    update public.profiles set balance = balance + tx.amount where id = tx.profile_id;
  elsif tx.kind = 'withdraw' and _status = 'rejected' then
    update public.profiles set balance = balance + tx.amount where id = tx.profile_id;
  end if;

  update public.transactions set status = _status, admin_note = coalesce(_note, admin_note),
    gateway_provider = coalesce(_provider, gateway_provider), gateway_ref = coalesce(_ref, gateway_ref),
    gateway_message = coalesce(_message, gateway_message),
    resolved_at = case when _status in ('approved','rejected') then now() else resolved_at end
  where id = _tx_id returning * into tx;
  return tx;
end $$;

create or replace function public.request_withdrawal(_profile_id uuid, _amount numeric, _method text, _bank jsonb)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare tx public.transactions; bal numeric;
begin
  select balance into bal from public.profiles where id = _profile_id for update;
  if bal is null then raise exception 'profile not found'; end if;
  if bal < _amount then raise exception 'Insufficient balance'; end if;
  update public.profiles set balance = balance - _amount where id = _profile_id;
  insert into public.transactions (profile_id, kind, amount, method, bank, status)
  values (_profile_id, 'withdraw', _amount, _method, _bank, 'processing') returning * into tx;
  return tx;
end $$;

create or replace function public.claim_gift_code(_profile_id uuid, _code text)
returns numeric language plpgsql security definer set search_path = public as $$
declare g public.gift_codes;
begin
  select * into g from public.gift_codes where code = upper(trim(_code)) and active;
  if g is null then raise exception 'Invalid or expired gift code.'; end if;
  if exists (select 1 from public.gift_claims where code = g.code and profile_id = _profile_id) then
    raise exception 'You have already claimed this gift code.';
  end if;
  insert into public.gift_claims (code, profile_id, amount) values (g.code, _profile_id, g.amount);
  update public.profiles set balance = balance + g.amount where id = _profile_id;
  return g.amount;
end $$;

insert into public.gift_codes (code, amount) values ('GIFT50',50),('WELCOME100',100),('BG678',678);