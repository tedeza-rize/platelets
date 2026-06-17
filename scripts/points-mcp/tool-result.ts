import type { ToolResult } from "./types.ts";

export function asToolResult(payload: Record<string, unknown>): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}
