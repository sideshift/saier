--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

create table account (
  id text primary key not null,
  username text not null unique,
  allow_negative_balance boolean default false,
  created_at text not null,
  balance numeric not null default 0 check ((allow_negative_balance = true) or (balance >= 0))
);

create table transfer (
  id text primary key not null,
  created_at text not null,
  from_account_id text not null references account(id),
  to_account_id text not null references account(id) check (from_account_id <> to_account_id),
  amount numeric not null check (amount > 0)
);

create trigger transfer_trigger
after insert on transfer
begin
  update account
  set balance = balance - new.amount
  where id = new.from_account_id;

  update account
  set balance = balance + new.amount
  where id = new.to_account_id;
end;

create table sideshift_order (
  id text primary key not null,
  created_at text not null,
  account_id text not null references account(id),
  deposit_method_id text not null
);

create table sideshift_deposit (
  id text primary key not null,
  created_at text not null,
  order_id text not null references sideshift_order(id),
  status text not null
);

insert into account (id, created_at, allow_negative_balance, username)
select 'funding', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), true, '/funding';

--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------
