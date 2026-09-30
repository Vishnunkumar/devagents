# Web Search MCP

Cloudflare Worker MCP: generic public-page scrape, plus job-biased search helpers. Same layout as the FPL server.

## Tools

- `scrape_url` — any public URL → title, description, text, links, plus job-like records when they exist
- `scrape_job` — same fetch, trimmed toward job fields
- `search_web` — unbiased URL search (DuckDuckGo HTML → Bing → Brave)
- `search_job_urls` — same engines, query biased toward careers/ATS
- `search_and_scrape` — job search, then `scrape_url` on a few hits

Extraction is generic: HTML tags, JSON-LD, embedded/`__NEXT_DATA__` JSON (walk objects that look like jobs), listing links, raw JSON bodies. Greenhouse, Lever, Ashby, and Workable public JSON APIs are used when the URL matches — they are not required.

LinkedIn / Indeed / Glassdoor are not scraped (login walls). JS-only boards and bot challenges fail; that is expected.

Search from a Worker IP is often blocked. If `hits` is empty, call `scrape_url` with a known URL, or run `npm run dev` locally.

## Run

```bash
cd web-search-mcp
npm install
npm run dev
```

MCP endpoint: `http://127.0.0.1:8787/mcp` (or the port Wrangler prints).

```bash
npm run deploy
```

Cursor `mcp.json`:

```json
{
  "mcpServers": {
    "web-search": {
      "url": "https://web-search-mcp.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```
