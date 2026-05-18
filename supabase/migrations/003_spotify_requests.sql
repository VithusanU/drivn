-- SPOTIFY ACCESS REQUESTS
create table public.spotify_requests (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  user_email      text not null,
  user_name       text,
  spotify_email   text not null,
  status          text default 'pending' not null check (status in ('pending', 'approved', 'denied')),
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  unique(user_id)
);

alter table public.spotify_requests enable row level security;

-- Users can insert and read their own request
create policy "Users can insert own request" on public.spotify_requests
  for insert with check (auth.uid() = user_id);

create policy "Users can read own request" on public.spotify_requests
  for select using (auth.uid() = user_id);

create policy "Users can update own request" on public.spotify_requests
  for update using (auth.uid() = user_id);

-- Admin can read and update all requests (admin check done on client)
create policy "Admin can read all requests" on public.spotify_requests
  for select using (true);

create policy "Admin can update all requests" on public.spotify_requests
  for update using (true);

create trigger spotify_requests_updated_at
  before update on public.spotify_requests
  for each row execute procedure public.handle_updated_at();
