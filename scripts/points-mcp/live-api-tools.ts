import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import {
  fireSafetyApiStatusForMcp,
  itsTrafficSummaryForMcp,
} from "./live-apis.ts";
import { asToolResult } from "./tool-result.ts";

export function registerLiveApiTools(server: McpServer) {
  server.registerTool(
    "fire_safety_api_status",
    {
      description:
        "Return Fire Safety BigData119 API configuration status and approved data families. Does not expose the approval key or raw provider records.",
      inputSchema: {},
      title: "Fire Safety API Status",
    },
    async () =>
      asToolResult({
        fireSafetyApi: fireSafetyApiStatusForMcp(),
      }),
  );

  server.registerTool(
    "its_traffic_summary",
    {
      description:
        "Return a bounded ITS live traffic speed summary around Korean coordinates. Raw ITS records and API keys are never returned.",
      inputSchema: {
        latitude: z.number().min(32).max(39),
        longitude: z.number().min(124).max(132),
        radiusDegrees: z.number().min(0.005).max(0.2).optional().default(0.035),
      },
      title: "ITS Traffic Summary",
    },
    async (args) =>
      asToolResult({
        traffic: await itsTrafficSummaryForMcp(args),
      }),
  );
}
