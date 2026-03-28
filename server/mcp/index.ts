#!/usr/bin/env node
/**
 * Voisli MCP Server — exposes Voisli voice and meeting capabilities
 * as tools for Claude, and any other MCP-compatible AI agent.
 *
 * Communicates over stdio (standard for MCP servers invoked by
 * Claude Desktop, Claude Code, etc.).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

const server = new McpServer({
  name: "voisli",
  version: pkg.version,
});

// Register the active voice tools only.
registerTools(server);
registerResources(server);

// Connect via stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
