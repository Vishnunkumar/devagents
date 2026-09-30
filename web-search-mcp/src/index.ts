/**
 * Stateless web search + scrape MCP on Cloudflare Workers (same pattern as FPL MCP).
 */

import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";

import { INSTRUCTIONS, registerJobSearch } from "./tools";

function createServer() {
  const server = new McpServer(
    { name: "web-search", version: "0.2.0" },
    { instructions: INSTRUCTIONS },
  );
  registerJobSearch(server);
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
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname === "/") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/" && request.method === "GET") {
      const mcp = new URL("/mcp", url.origin).href;
      return Response.json(
        {
          name: "Web Search MCP",
          mcp,
          tools: ["search_web", "search_job_urls", "scrape_url", "scrape_job", "search_and_scrape"],
          instructions:
            "Add /mcp as a custom MCP connector. Public HTML/JSON only — no auth, no unlocker.",
        },
        { headers: { ...corsHeaders(), "Cache-Control": "no-store" } },
      );
    }

    return createMcpHandler(() => createServer(), {
      route: "/mcp",
      corsOptions: { origin: "*" },
      legacy: "stateless",
    })(request, env, ctx);
  },
} satisfies ExportedHandler;
