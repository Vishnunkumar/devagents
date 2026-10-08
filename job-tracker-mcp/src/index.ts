/**
 * Stateless Supabase job-tracker MCP on Cloudflare Workers.
 */

import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";

import type { Env } from "./types";
import { INSTRUCTIONS, registerTracker } from "./tools";

const TOOLS = [
  "ensure_schema",
  "list_jobs",
  "create_jobs",
  "update_job",
  "log_search_run",
];

function createServer(env: Env) {
  const server = new McpServer(
    { name: "job-tracker", version: "0.2.0" },
    { instructions: INSTRUCTIONS },
  );
  registerTracker(server, env);
  return server;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname === "/") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/" && request.method === "GET") {
      const mcp = new URL("/mcp", url.origin).href;
      return Response.json(
        {
          name: "Job Tracker MCP",
          mcp,
          tools: TOOLS,
          instructions:
            "Add /mcp as a custom MCP connector. Set Supabase URL + API key secrets. " +
            "Run schema.sql and schema-rls-policies.sql in Supabase once.",
        },
        { headers: { ...corsHeaders(), "Cache-Control": "no-store" } },
      );
    }

    return createMcpHandler(() => createServer(env), {
      route: "/mcp",
      corsOptions: { origin: "*" },
      legacy: "stateless",
    })(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
