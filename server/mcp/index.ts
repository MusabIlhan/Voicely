#!/usr/bin/env node
/**
 * Voisli MCP Server CLI entrypoint.
 *
 * This launches the stdio transport used by local MCP clients such as
 * Claude Desktop and Claude Code. The HTTP transport is mounted by the
 * voice backend at `/mcp`.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createVoisliMcpServer } from "./server.js";

// Connect via stdio transport
async function main() {
  const server = createVoisliMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
