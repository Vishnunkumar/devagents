import { fetchPage } from "./http";
import { decodeHtml, isAtsHost, isLoginWall, stripTags } from "./extract";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string | null;
  kind: "ats" | "employer" | "login_wall" | "other";
  engine: string;
};

const SKIP_HOSTS = [
  "duckduckgo.com",
  "bing.com",
  "microsoft.com",
  "brave.com",
  "google.com",
  "googleusercontent.com",
  "youtube.com",
  "wikipedia.org",
  "apify.com",
  "g2.com",
  "reddit.com",
  "facebook.com",
  "x.com",
  "twitter.com",
];

function classify(url: string): SearchHit["kind"] {
  if (isLoginWall(url)) return "login_wall";
  if (isAtsHost(url)) return "ats";
  return "other";
}

function cleanUrl(raw: string): string | null {
  let href = decodeHtml(raw.trim());
  if (href.startsWith("//")) href = "https:" + href;
  try {
    const u = new URL(href, "https://example.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return cleanUrl(uddg);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (SKIP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function pushHit(
  out: SearchHit[],
  seen: Set<string>,
  url: string | null,
  title: string,
  snippet: string | null,
  engine: string,
) {
  if (!url || seen.has(url)) return;
  seen.add(url);
  out.push({
    title: stripTags(title).slice(0, 200) || url,
    url,
    snippet: snippet ? stripTags(snippet).slice(0, 280) : null,
    kind: classify(url),
    engine,
  });
}

function parseDdg(html: string, engine: string): SearchHit[] {
  const out: SearchHit[] = [];
  const seen = new Set<string>();
  const re =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    pushHit(out, seen, cleanUrl(m[1]), m[2], null, engine);
  }
  const uddg = /[?&]uddg=([^&"]+)/gi;
  while ((m = uddg.exec(html))) {
    pushHit(out, seen, cleanUrl(decodeURIComponent(m[1])), decodeURIComponent(m[1]), null, engine);
  }
  return out;
}

function parseBing(html: string): SearchHit[] {
  const out: SearchHit[] = [];
  const seen = new Set<string>();
  const re = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    pushHit(out, seen, cleanUrl(m[1]), m[2], null, "bing");
  }
  return out;
}

function parseBrave(html: string): SearchHit[] {
  const out: SearchHit[] = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href="(https?:[^"]+)"[^>]*class="[^"]*svelte-[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    pushHit(out, seen, cleanUrl(m[1]), m[2], null, "brave");
  }
  if (!out.length) {
    const loose = /<a[^>]+href="(https?:\/\/(?!cdn\.|search\.brave)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = loose.exec(html))) {
      const href = cleanUrl(m[1]);
      if (!href) continue;
      const title = stripTags(m[2]).split(/[·|»]/).pop()?.trim() || stripTags(m[2]);
      pushHit(out, seen, href, title.slice(0, 200), null, "brave");
    }
  }
  return out;
}

export function buildJobQuery(query: string, region?: string | null): string {
  const loc = region?.trim() ? ` ${region.trim()}` : "";
  return `${query.trim()}${loc} (job OR jobs OR careers) (greenhouse OR lever OR ashby OR workable OR "job board")`;
}

export async function searchJobUrls(
  query: string,
  limit = 10,
): Promise<{ engine: string; hits: SearchHit[]; warning: string | null }> {
  const q = query.trim();
  const tries: Array<{ engine: string; run: () => Promise<SearchHit[]> }> = [
    {
      engine: "duckduckgo",
      run: async () => {
        const page = await fetchPage("https://html.duckduckgo.com/html/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ q }).toString(),
        });
        if (page.blocked || page.status >= 400) throw new Error(page.blockReason || `http_${page.status}`);
        return parseDdg(page.body, "duckduckgo");
      },
    },
    {
      engine: "bing",
      run: async () => {
        const page = await fetchPage(
          `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en`,
        );
        if (page.blocked || page.status >= 400) throw new Error(page.blockReason || `http_${page.status}`);
        return parseBing(page.body);
      },
    },
    {
      engine: "brave",
      run: async () => {
        const page = await fetchPage(
          `https://search.brave.com/search?q=${encodeURIComponent(q)}&source=web`,
        );
        if (page.blocked || page.status >= 400) throw new Error(page.blockReason || `http_${page.status}`);
        return parseBrave(page.body);
      },
    },
  ];

  const errors: string[] = [];
  for (const t of tries) {
    try {
      const ranked = (await t.run()).sort((a, b) => {
        const order = { ats: 0, employer: 1, other: 2, login_wall: 3 };
        return order[a.kind] - order[b.kind];
      });
      const hits = ranked.slice(0, Math.max(1, Math.min(limit, 20)));
      if (hits.length) return { engine: t.engine, hits, warning: null };
      errors.push(`${t.engine}: no results`);
    } catch (e) {
      errors.push(`${t.engine}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return {
    engine: "none",
    hits: [],
    warning:
      "Search engines blocked this datacenter IP (common on Cloudflare Workers). " +
      "Pass known URLs to scrape_url, or run wrangler dev locally. " +
      errors.join(" | "),
  };
}
