# Relocation Job Search Agent

A human-in-the-loop discovery agent for Vishnu's Europe relocation campaign. It reuses the existing `web-search-mcp` and `job-tracker-mcp`; it does not introduce another scraper, database, or browser installation.

## First release

- Discover vacancies for two countries per run using search queries and employer career pages.
- Verify each vacancy at the original employer/ATS URL before recommending it.
- Score technical fit, seniority, English-language suitability, hiring-from-India evidence, and relocation feasibility separately.
- Preserve uncertainty: visa sponsorship is `yes`, `likely`, `unknown`, or `no`; absence of sponsorship wording is not proof of `no`.
- Check existing Job Tracker records before discovery and deduplicate before insertion.
- Save only verified, relevant vacancies. Never apply, contact employers, or send personal data.

## Existing integrations

- `web-search-mcp`: `search_web`, `search_job_urls`, `scrape_url`, `scrape_job`, `search_and_scrape`.
- `job-tracker-mcp`: `list_jobs`, `create_jobs`, `log_search_run`.

The MCP servers are the source of truth for their own tool schemas. Do not duplicate their network/scraping implementations here.

## Run contract

1. Load `AGENT.md` and `config/campaign.json`.
2. Read existing jobs from Job Tracker before searching.
3. Run only the requested country pair (default: next pair in the rotation).
4. Search several role families and source types; report source failures rather than silently dropping them.
5. Verify original employer listing, live status, location, seniority and application URL.
6. Classify visa evidence and explain the evidence in plain language.
7. Save qualified vacancies, then log the search run.
8. Return a compact shortlist with direct apply links and reasons to apply / risks.

## Current campaign

Estonia and Lithuania are paused/removed from the active rotation after repeated CloudFront 403 access failures. The active rotation begins with Norway + Sweden. See `config/campaign.json`.

## Non-goals

- No automatic applications, CV submissions, recruiter outreach, or account creation.
- No scraping behind authentication, CAPTCHAs, or access controls.
- No claiming a job is open based only on a search snippet or aggregator.
- No inventing sponsorship, salary, relocation benefits, or job URLs.
