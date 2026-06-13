import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("points MCP exposes bounded place geocoding for map-assisted LLM flows", async () => {
  const source = await readFile("scripts/points-mcp.ts", "utf8");

  assert.match(source, /server\.registerTool\(\s*"geocode_place"/);
  assert.match(source, /Kakao Local/);
  assert.match(source, /isWithinKoreaCoordinates/);
  assert.match(source, /Returns no raw provider payload/);
});

test("points MCP exposes normalized assembly protests without raw board text", async () => {
  const source = await readFile("scripts/points-mcp.ts", "utf8");
  const toolStart = source.indexOf('"list_assembly_protests"');
  const toolSource = source.slice(
    toolStart,
    source.indexOf('"grounding_snapshot"'),
  );

  assert.ok(toolStart > 0);
  assert.match(source, /server\.registerTool\(\s*"list_assembly_protests"/);
  assert.match(toolSource, /listAssemblyProtestsForMcp/);
  assert.match(toolSource, /Raw board text is never returned/);
  assert.doesNotMatch(toolSource, /raw_json/);
});
