#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPointsMcpTools } from "./points-mcp/tools.ts";

const server = new McpServer({
  name: "platelets-points",
  version: "0.1.0",
});

registerPointsMcpTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
