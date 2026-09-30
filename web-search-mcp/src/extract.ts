export function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export function stripTags(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function meta(html: string, key: string): string | null {
  const prop = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["'][^>]*>`,
    "i",
  );
  const m = html.match(re) || html.match(re2);
  return m ? decodeHtml(m[1]).trim() : null;
}

export function tagText(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? stripTags(m[1]).slice(0, 300) : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function flattenLd(node: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(flattenLd);
  const rec = asRecord(node);
  if (!rec) return [];
  const graph = rec["@graph"];
  if (Array.isArray(graph)) return graph.flatMap(flattenLd);
  return [rec];
}

function isJobPosting(rec: Record<string, unknown>): boolean {
  const t = rec["@type"];
  if (typeof t === "string") return t.toLowerCase().includes("jobposting");
  if (Array.isArray(t)) return t.some((x) => String(x).toLowerCase().includes("jobposting"));
  return false;
}

function orgName(v: unknown): string | null {
  if (typeof v === "string") return v;
  const rec = asRecord(v);
  if (!rec) return null;
  return typeof rec.name === "string" ? rec.name : null;
}

function locationText(v: unknown): string | null {
  if (typeof v === "string") return v;
  const rec = asRecord(v);
  if (!rec) return null;
  if (typeof rec.name === "string") return rec.name;
  const addr = asRecord(rec.address) ?? rec;
  const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
    .map((x) => (typeof x === "string" ? x : asRecord(x)?.name))
    .filter((x): x is string => typeof x === "string");
  return parts.length ? parts.join(", ") : null;
}

export type JobRecord = {
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  employment_type: string | null;
  date_posted: string | null;
  url: string;
  source: string;
};

export function jobsFromJsonLd(html: string, pageUrl: string): JobRecord[] {
  const jobs: JobRecord[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim());
      for (const rec of flattenLd(parsed)) {
        if (!isJobPosting(rec)) continue;
        const desc = typeof rec.description === "string" ? stripTags(rec.description).slice(0, 2000) : null;
        jobs.push({
          title: typeof rec.title === "string" ? rec.title : null,
          company: orgName(rec.hiringOrganization),
          location: locationText(rec.jobLocation),
          description: desc,
          employment_type: rec.employmentType == null ? null : String(rec.employmentType),
          date_posted: typeof rec.datePosted === "string" ? rec.datePosted : null,
          url: typeof rec.url === "string" ? rec.url : pageUrl,
          source: "jsonld",
        });
      }
    } catch {
      /* ignore bad JSON-LD */
    }
  }
  return jobs;
}

export function jobFromMetaTags(html: string, pageUrl: string): JobRecord {
  const title =
    meta(html, "og:title") ||
    meta(html, "twitter:title") ||
    tagText(html, "h1") ||
    tagText(html, "title");
  const description = (
    meta(html, "og:description") ||
    meta(html, "description") ||
    meta(html, "twitter:description")
  )?.slice(0, 2000) ?? null;
  const company =
    meta(html, "og:site_name") ||
    meta(html, "author") ||
    null;
  return {
    title,
    company,
    location: meta(html, "geo.placename") || meta(html, "og:locality"),
    description,
    employment_type: null,
    date_posted: null,
    url: pageUrl,
    source: "html_tags",
  };
}

export const LOGIN_WALL_HOSTS = [
  "linkedin.com",
  "www.linkedin.com",
  "indeed.com",
  "www.indeed.com",
  "glassdoor.com",
  "www.glassdoor.com",
];

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isLoginWall(url: string): boolean {
  const h = hostOf(url);
  return LOGIN_WALL_HOSTS.some((x) => h === x || h.endsWith(`.${x.replace(/^www\./, "")}`));
}

export function isAtsHost(url: string): boolean {
  const h = hostOf(url);
  return (
    h.includes("greenhouse.io") ||
    h.includes("lever.co") ||
    h.includes("ashbyhq.com") ||
    h.includes("workable.com") ||
    h.includes("myworkdayjobs.com") ||
    h.includes("smartrecruiters.com") ||
    h.includes("icims.com") ||
    h.includes("recruitee.com") ||
    h.includes("personio.com") ||
    h.includes("personio.de") ||
    h.includes("bamboohr.com") ||
    h.includes("jobvite.com")
  );
}

export type PageLink = { url: string; text: string };

export type PageRecord = {
  title: string | null;
  description: string | null;
  site_name: string | null;
  text: string | null;
  links: PageLink[];
};

function absUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function pageFromHtml(html: string, pageUrl: string): PageRecord {
  const title =
    meta(html, "og:title") ||
    meta(html, "twitter:title") ||
    tagText(html, "title") ||
    tagText(html, "h1");
  const description =
    meta(html, "og:description") ||
    meta(html, "description") ||
    meta(html, "twitter:description");
  const text = stripTags(html).slice(0, 8000) || null;
  return {
    title,
    description: description?.slice(0, 2000) ?? null,
    site_name: meta(html, "og:site_name"),
    text,
    links: linksFromHtml(html, pageUrl),
  };
}

export function linksFromHtml(html: string, pageUrl: string, limit = 50): PageLink[] {
  const out: PageLink[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = absUrl(m[1], pageUrl);
    if (!url || seen.has(url)) continue;
    const text = stripTags(m[2]).slice(0, 160);
    if (!text || text.length < 2) continue;
    seen.add(url);
    out.push({ url, text });
    if (out.length >= limit) break;
  }
  return out;
}

const JOB_PATH =
  /\/(jobs?|careers?|openings?|positions?|vacancies|postings?|opportunities)(\/|$)/i;

export function looksLikeJobPath(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    if (!JOB_PATH.test(path)) return false;
    const parts = path.split("/").filter(Boolean);
    return parts.length >= 2;
  } catch {
    return false;
  }
}

export function isLikelyJobPage(url: string): boolean {
  return isAtsHost(url) || looksLikeJobPath(url);
}

const SKIP_LINK_TEXT = /^(view all|see all|careers|jobs|home|apply now|learn more|read more|privacy|cookie)/i;

export function jobsFromListingLinks(html: string, pageUrl: string): JobRecord[] {
  const jobs: JobRecord[] = [];
  const seen = new Set<string>();
  for (const link of linksFromHtml(html, pageUrl, 80)) {
    if (!looksLikeJobPath(link.url) && !isAtsHost(link.url)) continue;
    if (SKIP_LINK_TEXT.test(link.text)) continue;
    if (link.text.length < 8) continue;
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    jobs.push({
      title: link.text,
      company: meta(html, "og:site_name"),
      location: null,
      description: null,
      employment_type: null,
      date_posted: null,
      url: link.url,
      source: "html_links",
    });
    if (jobs.length >= 40) break;
  }
  return jobs;
}

function strField(rec: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
    const nested = asRecord(v);
    if (nested) {
      const name = strField(nested, ["name", "title", "text", "label", "city"]);
      if (name) return name;
    }
  }
  return null;
}

function looksLikeJobObject(rec: Record<string, unknown>): boolean {
  const title = strField(rec, ["title", "text", "name", "jobTitle", "position", "headline"]);
  const url = strField(rec, [
    "url",
    "hostedUrl",
    "absolute_url",
    "absoluteUrl",
    "applyUrl",
    "jobUrl",
    "shortlink",
    "link",
  ]);
  if (!title || title.length < 4) return false;
  if (url) return true;
  const loc = strField(rec, ["location", "locations", "city", "workplace"]);
  const desc = strField(rec, ["description", "descriptionPlain", "content", "body"]);
  return Boolean(loc && desc);
}

function jobFromUnknown(rec: Record<string, unknown>, pageUrl: string, source: string): JobRecord | null {
  if (!looksLikeJobObject(rec)) return null;
  const title = strField(rec, ["title", "text", "name", "jobTitle", "position", "headline"]);
  const rawUrl = strField(rec, [
    "url",
    "hostedUrl",
    "absolute_url",
    "absoluteUrl",
    "applyUrl",
    "jobUrl",
    "shortlink",
    "link",
  ]);
  return {
    title,
    company: strField(rec, ["company", "companyName", "company_name", "department", "hiringOrganization"]),
    location: strField(rec, ["location", "locations", "city", "workplace", "jobLocation"]),
    description: strField(rec, ["description", "descriptionPlain", "content", "body"])?.slice(0, 2000) ?? null,
    employment_type: strField(rec, ["employmentType", "employment_type", "commitment", "type"]),
    date_posted: strField(rec, ["datePosted", "updated_at", "createdAt", "publishedAt"]),
    url: rawUrl ? absUrl(rawUrl, pageUrl) || pageUrl : pageUrl,
    source,
  };
}

export function jobsFromUnknownJson(data: unknown, pageUrl: string, source = "json"): JobRecord[] {
  const out: JobRecord[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown, depth: number) => {
    if (depth > 8 || out.length >= 40) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;
    const job = jobFromUnknown(rec, pageUrl, source);
    if (job?.title) {
      const key = `${job.title}|${job.url}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(job);
      }
    }
    for (const v of Object.values(rec)) walk(v, depth + 1);
  };

  walk(data, 0);
  return out;
}

export function jobsFromEmbeddedJson(html: string, pageUrl: string): JobRecord[] {
  const out: JobRecord[] = [];
  const re =
    /<script[^>]+type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(...jobsFromUnknownJson(JSON.parse(m[1].trim()), pageUrl, "embedded_json"));
    } catch {
      /* ignore */
    }
  }
  const next = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next) {
    try {
      out.push(...jobsFromUnknownJson(JSON.parse(next[1].trim()), pageUrl, "next_data"));
    } catch {
      /* ignore */
    }
  }
  return dedupeJobs(out);
}

export function dedupeJobs(jobs: JobRecord[]): JobRecord[] {
  const seen = new Set<string>();
  const out: JobRecord[] = [];
  for (const job of jobs) {
    const key = `${(job.title || "").toLowerCase()}|${job.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(job);
  }
  return out;
}
