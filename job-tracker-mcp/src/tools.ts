import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { todayIso } from "./normalize";
import { toCompact } from "./schema";
import {
  createJobs,
  ensureSchema,
  listJobs,
  logSearchRun,
  pipelineCounts,
  resolveUserId,
  updateJob,
} from "./supabase";
import type { Env } from "./types";
import { REGIONS, STATUSES, VISA, WORK_MODES } from "./types";

export const INSTRUCTIONS =
  "Relocation job tracker backed by Supabase (jobs scoped by user_id / persona slug). " +
  "Fetch existing jobs before searching the web. create_jobs only inserts new discovered rows " +
  "(dedupes by URL and company+title+location within the same user_id). " +
  "Pass user_id on every call (same id as persona.json id, e.g. vishnu-backend). " +
  "Do not overwrite Status, Notes, Applied date, or Outreach unless the user asked. " +
  "The user tracks the pipeline in the Vercel/Supabase UI. Search the web with the separate scraper MCP, not this server.";

function dumps(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: dumps(payload) }] };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: dumps({ error: message }) }],
    isError: true as const,
  };
}

const newJobSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  country: z.string().optional(),
  region: z.enum(REGIONS).optional(),
  source: z.string().optional(),
  visa_sponsorship: z.enum(VISA).optional(),
  visa_notes: z.string().optional(),
  salary: z.string().optional(),
  work_mode: z.enum(WORK_MODES).optional(),
  description_snippet: z.string().optional(),
});

export function registerTracker(server: McpServer, env: Env) {
  server.registerTool(
    "ensure_schema",
    {
      description:
        "Verify Supabase jobs and search_runs tables are reachable. " +
        "Create tables by running schema.sql in the Supabase SQL Editor (not via this tool).",
      inputSchema: {
        confirm: z.boolean().optional().describe("Optional; runs the connectivity check"),
      },
    },
    async () => {
      try {
        return ok(await ensureSchema(env));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_jobs",
    {
      description:
        "List compact job rows plus pipeline counts. Call this before any web search to avoid duplicates. " +
        "Optional status/region filters.",
      inputSchema: {
        user_id: z
          .string()
          .min(1)
          .optional()
          .describe("Persona slug (matches public.users.user_id)"),
        status: z.enum(STATUSES).optional(),
        region: z.enum(REGIONS).optional(),
      },
    },
    async ({ user_id, status, region }) => {
      try {
        const userId = resolveUserId(env, user_id);
        const jobs = await listJobs(env, { user_id: userId, status, region });
        return ok({
          counts: pipelineCounts(jobs),
          jobs: jobs.map(toCompact),
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "create_jobs",
    {
      description:
        "Insert newly discovered jobs. Skips duplicate Job URL or company+title+location. " +
        "Always sets Status=discovered. Max 15 jobs per call. Never use this to change pipeline status.",
      inputSchema: {
        user_id: z
          .string()
          .min(1)
          .optional()
          .describe("Persona slug (matches public.users.user_id)"),
        jobs: z.array(newJobSchema).min(1).max(15),
      },
    },
    async ({ user_id, jobs }) => {
      try {
        const userId = resolveUserId(env, user_id);
        const result = await createJobs(env, userId, jobs, todayIso());
        return ok({
          created_count: result.created.length,
          skipped_count: result.skipped.length,
          existing_count: result.existing_count,
          created: result.created.map(toCompact),
          skipped: result.skipped,
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_job",
    {
      description:
        "Patch one job by record_id (uuid) or Job URL. Use only when the user asks to change " +
        "status, notes, outreach, or similar. Prefer the tracker UI for routine updates.",
      inputSchema: {
        user_id: z
          .string()
          .min(1)
          .optional()
          .describe("Persona slug when looking up by url"),
        record_id: z.string().optional(),
        url: z.string().optional(),
        status: z.enum(STATUSES).optional(),
        notes: z.string().optional(),
        applied_date: z.string().optional(),
        outreach_message: z.string().optional(),
        visa_sponsorship: z.enum(VISA).optional(),
        visa_notes: z.string().optional(),
        follow_up_date: z.string().optional(),
        salary: z.string().optional(),
        work_mode: z.enum(WORK_MODES).optional(),
      },
    },
    async (args) => {
      try {
        if (!args.record_id && !args.url) {
          return fail(new Error("Provide record_id or url"));
        }
        const userId = resolveUserId(env, args.user_id);
        const job = await updateJob(
          env,
          userId,
          { record_id: args.record_id, url: args.url },
          {
            status: args.status,
            notes: args.notes,
            applied_date: args.applied_date,
            outreach_message: args.outreach_message,
            visa_sponsorship: args.visa_sponsorship,
            visa_notes: args.visa_notes,
            follow_up_date: args.follow_up_date,
            salary: args.salary,
            work_mode: args.work_mode,
          },
          todayIso(),
        );
        return ok(job);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "log_search_run",
    {
      description: "Append one row to search_runs after a web search (query, region, counts).",
      inputSchema: {
        user_id: z
          .string()
          .min(1)
          .optional()
          .describe("Persona slug (matches public.users.user_id)"),
        query: z.string().min(1),
        region: z.string().optional(),
        results_count: z.number().int().min(0),
        new_jobs_added: z.number().int().min(0),
        skipped_duplicates: z.number().int().min(0).optional(),
      },
    },
    async (args) => {
      try {
        const userId = resolveUserId(env, args.user_id);
        const { user_id: _u, ...rest } = args;
        return ok(await logSearchRun(env, userId, rest, todayIso()));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
