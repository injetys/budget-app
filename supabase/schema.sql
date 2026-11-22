-- Budget app schema. Every row belongs to one user; row-level security means
-- each person (you, your gf, friends) can only ever see their own data.

create table plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  plaid_item_id text unique not null,
  institution text,
  sync_cursor text,                -- for /transactions/sync
  created_at timestamptz default now()
);
-- Plaid access tokens live in a separate table that browsers can NEVER read.
create table plaid_secrets (
  item_id uuid primary key references plaid_items on delete cascade,
  access_token text not null
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  item_id uuid references plaid_items on delete cascade,
  plaid_account_id text unique,
  name text not null,
  institution text,
  mask text,
  type text not null check (type in ('checking','savings','credit'))
);

create table rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  match text not null,
  category_id text not null,
  unique (user_id, match)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  account_id uuid not null references accounts on delete cascade,
  plaid_transaction_id text unique,
  pending_transaction_id text,
  date date not null,
  merchant text not null,
  amount numeric(12,2) not null,   -- positive = money out (Plaid convention)
  pending boolean default false,
  plaid_category text,
  plaid_detailed text,
  category_id text not null,
  category_source text not null default 'plaid',
  kind text not null check (kind in ('spend','income','transfer')),
  transfer_pair_id text,
  reviewed boolean default false
);
create index on transactions (user_id, date);

alter table plaid_items  enable row level security;
alter table plaid_secrets enable row level security;  -- no policies = server-only
alter table accounts     enable row level security;
alter table rules        enable row level security;
alter table transactions enable row level security;

create policy "own" on plaid_items  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on accounts     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on rules        for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
