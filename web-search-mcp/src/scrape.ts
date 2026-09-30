import { fetchPage } from "./http";
import {
  decodeHtml,
  dedupeJobs,
  isLikelyJobPage,
  isLoginWall,
  jobFromMetaTags,
  jobsFromEmbeddedJson,
  jobsFromJsonLd,
  jobsFromListingLinks,
  jobsFromUnknownJson,
  pageFromHtml,
  stripTags,
  type JobRecord,
  type PageLink,
} from "./extract";

function htmlToText(s: string | undefined | null): string | null {
  if (!s) return null;
  let t = s;
  if (t.includes("&lt;")) t = decodeHtml(t);
  t = stripTags(t).slice(0, 2000);
  return t || null;
}

function mergeJob(primary: JobRecord, fallback: JobRecord): JobRecord {
  return {
    title: primary.title || fallback.title,
    company: primary.company || fallback.company,
    location: primary.location || fallback.location,
    description: primary.description || fallback.description,
    employment_type: primary.employment_type || fallback.employment_type,
    date_posted: primary.date_posted || fallback.date_posted,
    url: primary.url || fallback.url,
    source: primary.source === "html_tags" && fallback.source !== "html_tags" ? fallback.source : primary.source,
  };
}

function greenhouseApiUrl(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (!u.hostname.toLowerCase().includes("greenhouse.io")) return null;
    const jobs = u.pathname.match(/\/([^/]+)\/jobs\/(\d+)/);
    if (jobs) return `https://boards-api.greenhouse.io/v1/boards/${jobs[1]}/jobs/${jobs[2]}`;
    const board = u.searchParams.get("for");
    const token = u.searchParams.get("token") || u.searchParams.get("gh_jid");
    if (board && token) return `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${token}`;
    return null;
  } catch {
    return null;
  }
}

function leverApiUrl(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (!u.hostname.toLowerCase().includes("lever.co")) return null;
    const m = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{8,})/i);
    if (!m) return null;
    return `https://api.lever.co/v0/postings/${m[1]}/${m[2]}`;
  } catch {
    return null;
  }
}

function greenhouseBoardToken(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (!u.hostname.toLowerCase().includes("greenhouse.io")) return null;
    if (/\/jobs\/\d+/.test(u.pathname)) return null;
    const forParam = u.searchParams.get("for");
    if (forParam) return forParam;
    const parts = u.pathname.split("/").filter(Boolean);
    if (!parts[0] || parts[0] === "embed") return null;
    return parts[0];
  } catch {
    return null;
  }
}

function leverCompanyToken(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (!u.hostname.toLowerCase().includes("lever.co")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null;
    return parts[0];
  } catch {
    return null;
  }
}

function ashbyBoardToken(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (!u.hostname.toLowerCase().includes("ashbyhq.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

function workableAccount(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    const host = u.hostname.toLowerCase();
    if (host.endsWith(".workable.com") && host !== "apply.workable.com") {
      return host.split(".")[0] || null;
    }
    if (host.includes("workable.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function fromGreenhouse(apiUrl: string, pageUrl: string): Promise<JobRecord | null> {
  const page = await fetchPage(apiUrl, { headers: { Accept: "application/json" } });
  if (page.status >= 400 || page.blocked) return null;
  try {
    const j = JSON.parse(page.body) as {
      title?: string;
      company_name?: string;
      location?: { name?: string };
      updated_at?: string;
      content?: string;
      absolute_url?: string;
    };
    const board = apiUrl.match(/\/boards\/([^/]+)\//)?.[1] ?? null;
    return {
      title: j.title ?? null,
      company: j.company_name || board,
      location: j.location?.name ?? null,
      description: htmlToText(j.content),
      employment_type: null,
      date_posted: j.updated_at ?? null,
      url: j.absolute_url || pageUrl,
      source: "greenhouse_api",
    };
  } catch {
    return null;
  }
}

async function fromLever(apiUrl: string, pageUrl: string): Promise<JobRecord | null> {
  const page = await fetchPage(apiUrl, { headers: { Accept: "application/json" } });
  if (page.status >= 400 || page.blocked) return null;
  try {
    const j = JSON.parse(page.body) as {
      text?: string;
      hostedUrl?: string;
      createdAt?: number;
      categories?: { location?: string; commitment?: string };
      descriptionPlain?: string;
    };
    const company = apiUrl.match(/\/postings\/([^/]+)\//)?.[1] ?? null;
    return {
      title: j.text ?? null,
      company,
      location: j.categories?.location ?? null,
      description: htmlToText(j.descriptionPlain),
      employment_type: j.categories?.commitment ?? null,
      date_posted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      url: j.hostedUrl || pageUrl,
      source: "lever_api",
    };
  } catch {
    return null;
  }
}

async function jsonJobsFromUrl(apiUrl: string, pageUrl: string, source: string): Promise<JobRecord[]> {
  const page = await fetchPage(apiUrl, { headers: { Accept: "application/json" } });
  if (page.status >= 400 || page.blocked) return [];
  try {
    return jobsFromUnknownJson(JSON.parse(page.body), pageUrl, source);
  } catch {
    return [];
  }
}

export type ScrapeResult = {
  url: string;
  final_url: string;
  status: number;
  content_type: string | null;
  blocked: boolean;
  block_reason: string | null;
  login_wall: boolean;
  title: string | null;
  description: string | null;
  site_name: string | null;
  text: string | null;
  links: PageLink[];
  job: JobRecord | null;
  extra_jobs: JobRecord[];
};

function resultFromJobs(
  url: string,
  jobs: JobRecord[],
  extras?: Partial<ScrapeResult>,
): ScrapeResult {
  return {
    url,
    final_url: extras?.final_url ?? jobs[0]?.url ?? url,
    status: extras?.status ?? (jobs.length ? 200 : 0),
    content_type: extras?.content_type ?? "application/json",
    blocked: extras?.blocked ?? false,
    block_reason: extras?.block_reason ?? null,
    login_wall: false,
    title: extras?.title ?? jobs[0]?.title ?? null,
    description: extras?.description ?? jobs[0]?.description ?? null,
    site_name: extras?.site_name ?? jobs[0]?.company ?? null,
    text: extras?.text ?? null,
    links: extras?.links ?? jobs.map((j) => ({ url: j.url, text: j.title || j.url })).slice(0, 40),
    job: jobs[0] ?? null,
    extra_jobs: jobs.slice(1, 40),
  };
}

async function scrapeKnownJsonApis(url: string): Promise<ScrapeResult | null> {
  const ghBoard = greenhouseBoardToken(url);
  if (ghBoard) {
    const jobs = await jsonJobsFromUrl(
      `https://boards-api.greenhouse.io/v1/boards/${ghBoard}/jobs`,
      url,
      "greenhouse_board",
    );
    if (jobs.length) return resultFromJobs(url, jobs);
  }
  const gh = greenhouseApiUrl(url);
  if (gh) {
    const job = await fromGreenhouse(gh, url);
    if (job?.title) return resultFromJobs(url, [job]);
  }
  const lvBoard = leverCompanyToken(url);
  if (lvBoard) {
    const jobs = await jsonJobsFromUrl(`https://api.lever.co/v0/postings/${lvBoard}`, url, "lever_board");
    if (jobs.length) return resultFromJobs(url, jobs);
  }
  const lv = leverApiUrl(url);
  if (lv) {
    const job = await fromLever(lv, url);
    if (job?.title) return resultFromJobs(url, [job]);
  }
  const ashby = ashbyBoardToken(url);
  if (ashby) {
    const jobs = await jsonJobsFromUrl(
      `https://api.ashbyhq.com/posting-api/job-board/${ashby}`,
      url,
      "ashby_api",
    );
    if (jobs.length) return resultFromJobs(url, jobs);
  }
  const workable = workableAccount(url);
  if (workable && new URL(url).hostname.toLowerCase().includes("workable.com")) {
    const jobs = await jsonJobsFromUrl(
      `https://apply.workable.com/api/v1/widget/accounts/${workable}`,
      url,
      "workable_api",
    );
    if (jobs.length) return resultFromJobs(url, jobs);
  }
  return null;
}

export async function scrapePage(url: string): Promise<ScrapeResult> {
  if (isLoginWall(url)) {
    return {
      url,
      final_url: url,
      status: 0,
      content_type: null,
      blocked: true,
      block_reason: "login_wall_skip",
      login_wall: true,
      title: null,
      description: null,
      site_name: null,
      text: null,
      links: [],
      job: null,
      extra_jobs: [],
    };
  }

  const known = await scrapeKnownJsonApis(url);
  if (known) return known;

  const page = await fetchPage(url);
  const jsonType = page.contentType.toLowerCase().includes("json");

  if (jsonType) {
    try {
      const jobs = jobsFromUnknownJson(JSON.parse(page.body), page.finalUrl, "json_body");
      if (jobs.length) {
        return resultFromJobs(url, jobs, {
          final_url: page.finalUrl,
          status: page.status,
          content_type: page.contentType,
          blocked: page.blocked,
          block_reason: page.blockReason,
        });
      }
    } catch {
      /* fall through to HTML parse */
    }
  }

  const pageFields = pageFromHtml(page.body, page.finalUrl);
  const tags = jobFromMetaTags(page.body, page.finalUrl);
  const jsonld = jobsFromJsonLd(page.body, page.finalUrl);
  const embedded = jobsFromEmbeddedJson(page.body, page.finalUrl);
  const listed = jobsFromListingLinks(page.body, page.finalUrl);
  const mergedLd = jsonld.length ? [mergeJob(jsonld[0], tags), ...jsonld.slice(1)] : [];
  const jobs = dedupeJobs([...mergedLd, ...embedded, ...listed]);
  if (!jobs.length && tags.title && isLikelyJobPage(page.finalUrl)) jobs.push(tags);

  return {
    url,
    final_url: page.finalUrl,
    status: page.status,
    content_type: page.contentType || "text/html",
    blocked: page.blocked,
    block_reason: page.blockReason,
    login_wall: false,
    title: pageFields.title,
    description: pageFields.description,
    site_name: pageFields.site_name,
    text: pageFields.text,
    links: pageFields.links,
    job: jobs[0] ?? null,
    extra_jobs: jobs.slice(1, 40),
  };
}

export async function scrapeJob(url: string): Promise<ScrapeResult> {
  const page = await scrapePage(url);
  return {
    ...page,
    text: page.job ? null : page.text,
    links: page.job ? page.links.slice(0, 8) : page.links,
  };
}
