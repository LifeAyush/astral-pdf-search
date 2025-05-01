-- Enable pgvector extension for potential embedding storage if needed
create extension if not exists vector;

-- Create searches table
create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  created_at timestamp with time zone default now(),
  
  -- Add constraint for quick lookup
  constraint unique_searches unique (query)
);

-- Create search_results table
create table if not exists public.search_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references public.searches(id) on delete cascade,
  url text not null,
  title text not null,
  description text,
  total_pages integer,
  relevant_pages jsonb, -- Store page ranges as {start: number, end: number}[]
  preview_image_url text,
  cached_at timestamp with time zone default now(),
  
  -- Add constraints
  constraint unique_search_results unique (search_id, url)
);

-- Create RLS policies for public access (since no auth is required)
alter table public.searches enable row level security;
alter table public.search_results enable row level security;

-- Allow anyone to select from searches table
create policy "Allow public read access to searches" 
  on public.searches for select to anon 
  using (true);

-- Allow anyone to insert into searches table
create policy "Allow public insert access to searches" 
  on public.searches for insert to anon 
  with check (true);

-- Allow anyone to select from search_results table
create policy "Allow public read access to search_results" 
  on public.search_results for select to anon 
  using (true);

-- Allow anyone to insert into search_results table
create policy "Allow public insert access to search_results" 
  on public.search_results for insert to anon 
  with check (true);

-- Create indexes for performance
create index if not exists idx_searches_query on public.searches(query);
create index if not exists idx_searches_created_at on public.searches(created_at desc);
create index if not exists idx_search_results_search_id on public.search_results(search_id);