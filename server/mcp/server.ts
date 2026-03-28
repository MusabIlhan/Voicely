import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

export function createVoisliMcpServer(): McpServer {
  const server = new McpServer({
    name: "voisli",
    version: pkg.version,
  });

  registerTools(server);
  registerResources(server);

  return server;
}
