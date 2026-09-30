export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MAX_BYTES = 400_000;

export type FetchPage = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  blocked: boolean;
  blockReason: string | null;
};

export async function fetchPage(
  url: string,
  init?: RequestInit,
): Promise<FetchPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      ...init,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(init?.headers ?? {}),
      },
    });
    const contentType = res.headers.get("content-type") ?? "";
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    const body = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    const { blocked, blockReason } = detectBlock(res.status, body);
    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      contentType,
      body,
      blocked,
      blockReason,
    };
  } finally {
    clearTimeout(timer);
  }
}

function detectBlock(status: number, body: string): { blocked: boolean; blockReason: string | null } {
  if (status === 401 || status === 403 || status === 429) {
    return { blocked: true, blockReason: `http_${status}` };
  }
  const lower = body.slice(0, 8000).toLowerCase();
  const needles = [
    "just a moment",
    "cf-browser-verification",
    "attention required",
    "enable javascript and cookies",
    "verify you are human",
    "captcha",
    "access denied",
    "request unsuccessful",
  ];
  for (const n of needles) {
    if (lower.includes(n)) return { blocked: true, blockReason: n };
  }
  return { blocked: false, blockReason: null };
}
