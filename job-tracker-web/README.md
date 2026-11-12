# Job Tracker Web

Next.js UI for the relocation job pipeline stored in Supabase.

- Kanban by status
- Profile dropdown (loads `public.users`; jobs filtered by `user_id`)
- Filters: region, visa yes/likely, search
- Edit status, notes, visa, follow-up in a side drawer

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
