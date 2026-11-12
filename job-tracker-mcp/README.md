# Job Tracker MCP

Cloudflare Worker MCP that stores relocation jobs in **Supabase**. Search stays on `web-search-mcp`; this server only reads/writes the tracker.

## Tools

- `ensure_schema` — verify `users`, `jobs`, and `search_runs` are reachable
- `list_jobs` — compact rows + pipeline counts (call **before** every web search)
- `create_jobs` — insert discovered jobs; dedupe by URL and company+title+location
- `update_job` — patch status/notes/outreach when asked in chat
- `log_search_run` — append a search audit row

## Supabase setup (once)

1. **SQL Editor** → run `schema.sql` (new project)
2. **Existing DB** → run `schema-migration-002-users.sql` instead
3. **SQL Editor** → run `schema-rls-policies.sql` (required if you use the **publishable** key on the Worker)
4. For production Worker, prefer **`SUPABASE_SERVICE_ROLE_KEY`** in Wrangler secrets (no RLS policies needed for the Worker; still use RLS + anon key on Vercel)

### `public.users`

| Column | Purpose |
|--------|---------|
| `user_id` | Primary key; same slug as `persona.json` `id` (e.g. `vishnu-backend`) |
| `name` | Display name in UI |
| `persona_json` | Full persona document (`jsonb`); sync from disk when you want DB-backed profile |
| `role` | Short role family (`backend`, `qa`, …) |

`jobs.user_id` and `search_runs.user_id` reference `users.user_id`. Dedupe is per user.

## Env vars

| Variable | Where |
|----------|--------|
| `PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Worker + Vercel |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Worker (with RLS policies) or Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker only (recommended for deploy) |

## Local

```bash
cd job-tracker-mcp
npm install
copy .dev.vars.example .dev.vars
npm run dev
```

MCP: `http://127.0.0.1:8787/mcp`

## Deploy

```bash
npx wrangler secret put PUBLIC_SUPABASE_URL
npx wrangler secret put PUBLIC_SUPABASE_PUBLISHABLE_KEY
# or: npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy
```

Cursor `mcp.json`:

```json
{
  "mcpServers": {
    "job-tracker": {
      "url": "https://job-tracker-mcp.<subdomain>.workers.dev/mcp"
    }
  }
}
```

## Agent workflow

1. `list_jobs`
2. Search via `web-search` MCP
3. `create_jobs`
4. `log_search_run`
5. Track status in your Vercel app (or Supabase Table Editor)
