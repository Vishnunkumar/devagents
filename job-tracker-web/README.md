# Job Tracker Web

Next.js UI for the relocation job pipeline stored in Supabase.

- Kanban by status
- Profile dropdown (loads `public.users`; jobs filtered by `user_id`)
- Filters: region, individual visa sponsorship statuses, discovered-date range, and text search
- Sort jobs by discovered date (newest or oldest first)
- Edit status, notes, visa, and follow-up in a side drawer
- Delete a job from Supabase from its detail drawer (confirmation required)

Search/discovery stays in Cursor via `web-search-mcp` + `job-tracker-mcp`.

## Setup

1. Copy env:

```bash
copy .env.example .env.local
```

2. Fill Supabase **Project URL** and **publishable** key.

3. Ensure tables + RLS exist (from `../job-tracker-mcp`):

- `schema.sql` (new) or `schema-migration-002-users.sql` (existing DB)
- `schema-rls-policies.sql`

The Supabase RLS policies must permit the connected user to delete rows from `jobs` for the delete action to work.

```bash
npm install
npm run dev
```

## Deploy (Vercel)

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npx vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard and set the same env vars.
