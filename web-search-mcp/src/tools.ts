import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { scrapeJob, scrapePage } from "./scrape";
import { buildJobQuery, searchJobUrls } from "./search";

export const INSTRUCTIONS =
  "Generic public-web scraper with optional job helpers. " +
  "Use scrape_url on any http(s) page for title, text, links, and any job-like records found. " +
  "Use search_web for an unbiased URL search, or search_job_urls when hunting careers/ATS links. " +
  "This is not an unlocker: Cloudflare challenges, LinkedIn/Indeed/Glassdoor, and JS-only apps will fail. " +
  "Do not invent URLs or job fields; only return what the tools fetched.";

function dumps(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

function text(payload: unknown) {
  return { content: [{ type: "text" as const, text: dumps(payload) }] };
}

export function registerJobSearch(server: McpServer) {
  server.registerTool(
    "search_web",
    {
      description:
        "Search the public web (DuckDuckGo HTML, then Bing, then Brave). No job-specific operators. " +
        "Returns title, url, snippet, kind (ats | login_wall | other). " +
        "Datacenter IPs are often blocked; if hits are empty, pass known URLs to scrape_url.",
      inputSchema: {
        query: z.string().describe("Any search query"),
        limit: z.number().int().min(1).max(20).optional().default(10),
      },
    },
    async ({ query, limit }) => {
      const result = await searchJobUrls(query, limit ?? 10);
      return text({ query, ...result });
    },
  );

  server.registerTool(
    "search_job_urls",
    {
      description:
        "Search for job/careers URLs. Same engines as search_web, with job/ATS wording added to the query. " +
        "Skip login_wall hosts as final destinations. If hits are empty, scrape_url known URLs instead.",
      inputSchema: {
        query: z.string().describe("Role keywords, e.g. senior backend engineer"),
        region: z.string().optional().describe("Country or city, e.g. New Zealand"),
        limit: z.number().int().min(1).max(20).optional().default(10),
      },
    },
    async ({ query, region, limit }) => {
      const q = buildJobQuery(query, region);
      const result = await searchJobUrls(q, limit ?? 10);
      return text({ query, region: region ?? null, search_query: q, ...result });
    },
  );

  server.registerTool(
    "scrape_url",
    {
      description:
        "Fetch any public URL and return title, meta description, stripped text, links, and " +
        "job-like records if the page has JSON-LD, embedded JSON, listing links, or a known ATS JSON API. " +
        "Works for careers pages, blogs, docs, and generic HTML — not job-only.",
      inputSchema: {
        url: z.string().url(),
      },
    },
    async ({ url }) => text(await scrapePage(url)),
  );

  server.registerTool(
    "scrape_job",
    {
      description:
        "Same fetch as scrape_url, trimmed toward job fields (title, company, location, description). " +
        "Prefer scrape_url when you need page text and links.",
      inputSchema: {
        url: z.string().url(),
      },
    },
    async ({ url }) => text(await scrapeJob(url)),
  );

  server.registerTool(
    "search_and_scrape",
    {
      description:
        "search_job_urls then scrape_url on the first few non-login-wall hits. " +
        "Keep max_scrape small (default 4) to stay within Worker limits.",
      inputSchema: {
        query: z.string(),
        region: z.string().optional(),
        limit: z.number().int().min(1).max(15).optional().default(8),
        max_scrape: z.number().int().min(1).max(6).optional().default(4),
      },
    },
    async ({ query, region, limit, max_scrape }) => {
      const q = buildJobQuery(query, region);
      const search = await searchJobUrls(q, limit ?? 8);
      const toScrape = search.hits
        .filter((h) => h.kind !== "login_wall")
        .slice(0, max_scrape ?? 4);
      const pages = [];
      for (const hit of toScrape) {
        try {
          pages.push({ hit, scrape: await scrapePage(hit.url) });
        } catch (e) {
          pages.push({
            hit,
            scrape: { error: e instanceof Error ? e.message : String(e) },
          });
        }
      }
      return text({
        query,
        region: region ?? null,
        search_query: q,
        engine: search.engine,
        warning: search.warning,
        hits: search.hits,
        scraped: pages,
      });
    },
  );
}
