const TRACKING_PARAM = /^(utm_|gclid|fbclid|mc_|ref$|source$|campaign$)/i;

export function todayIso(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function normalizeJobUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
  }
  let out = parsed.toString();
  if (out.endsWith("/") && parsed.pathname !== "/") out = out.slice(0, -1);
  return out;
}

export function fingerprint(company: string, title: string, location: string): string {
  return [company, title, location]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

export function escapeFormula(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
