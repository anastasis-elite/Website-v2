-- Internal AOS social intelligence storage.
-- Tokens are encrypted by the application before insertion.

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  owner text not null,
  provider_account_id text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  status text not null default 'connected',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_accounts_provider_owner_key unique (provider, owner)
);

create table if not exists public.social_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform text not null,
  platform_user_id text not null,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  profile_url text,
  is_verified boolean not null default false,
  followers bigint not null default 0,
  following bigint not null default 0,
  likes bigint not null default 0,
  post_count bigint not null default 0,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_profiles_platform_user_key unique (platform, platform_user_id)
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.social_accounts(id) on delete cascade,
  platform text not null,
  post_id text not null,
  post_url text,
  title text,
  caption text,
  posted_at timestamptz,
  duration_seconds integer not null default 0,
  cover_image_url text,
  embed_url text,
  views bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  saves bigint not null default 0,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_posts_platform_post_key unique (platform, post_id)
);

-- Preserve compatibility when social_posts already exists from the first connector pass.
alter table public.social_posts add column if not exists account_id uuid references public.social_accounts(id) on delete cascade;
alter table public.social_posts add column if not exists title text;
alter table public.social_posts add column if not exists duration_seconds integer not null default 0;
alter table public.social_posts add column if not exists cover_image_url text;
alter table public.social_posts add column if not exists embed_url text;
alter table public.social_posts add column if not exists created_at timestamptz not null default now();
alter table public.social_posts add column if not exists updated_at timestamptz not null default now();
create unique index if not exists social_posts_platform_post_idx on public.social_posts(platform, post_id);

create table if not exists public.social_post_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform text not null,
  post_id text not null,
  metric_date date not null,
  views bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  saves bigint not null default 0,
  captured_at timestamptz not null default now(),
  constraint social_post_metrics_daily_key unique (platform, post_id, metric_date)
);

create index if not exists social_profiles_account_idx on public.social_profiles(account_id);
create index if not exists social_posts_account_posted_idx on public.social_posts(account_id, posted_at desc);
create index if not exists social_post_metrics_account_date_idx on public.social_post_metrics_daily(account_id, metric_date desc);

alter table public.social_accounts enable row level security;
alter table public.social_profiles enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_metrics_daily enable row level security;

-- No browser policies are intentional. Internal server routes use the secret/service key.
revoke all on table public.social_accounts from anon, authenticated;
revoke all on table public.social_profiles from anon, authenticated;
revoke all on table public.social_posts from anon, authenticated;
revoke all on table public.social_post_metrics_daily from anon, authenticated;

grant all on table public.social_accounts to service_role;
grant all on table public.social_profiles to service_role;
grant all on table public.social_posts to service_role;
grant all on table public.social_post_metrics_daily to service_role;
