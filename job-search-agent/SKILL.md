---
name: relocate-job-search
description: Discover, verify, score, and track European backend/software engineering vacancies for relocation candidates applying from India. Use when searching jobs, researching visa sponsorship, or updating the relocation job tracker.
---

# Relocation Job Search

Use this skill for the user's European relocation campaign.

1. Read [AGENT.md](./AGENT.md) for the candidate profile, country rotation, verification rules, visa evidence definitions, scoring and Job Tracker protocol.
2. Read [config/campaign.json](./config/campaign.json) for the active country pairs and search limits.
3. Read [config/source-catalog.json](./config/source-catalog.json) for discovery seeds. Treat them as leads, not guaranteed reachable sites.
4. Use the connected `web-search` MCP for public-web discovery and original-page verification.
5. Use the connected `job-tracker` MCP to list existing jobs before searching, insert only qualified new roles, and log the run.
6. Never auto-apply, contact employers, submit personal information, bypass access controls, or save unverified listings.

Keep the result concise: prioritize the strongest roles, show direct employer application URLs, and separate technical fit from visa confidence.
