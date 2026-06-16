import assert from "node:assert/strict";
import test from "node:test";
import { safeLinkHref } from "@/lib/safe-link";

test("safeLinkHref allows http, https, and same-origin paths", () => {
  assert.equal(
    safeLinkHref(" https://example.test/source?x=1 "),
    "https://example.test/source?x=1",
  );
  assert.equal(
    safeLinkHref("http://example.test/source"),
    "http://example.test/source",
  );
  assert.equal(safeLinkHref("/api/building-safety"), "/api/building-safety");
});

test("safeLinkHref rejects scriptable or ambiguous links", () => {
  assert.equal(safeLinkHref("javascript:alert(1)"), null);
  assert.equal(safeLinkHref("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(safeLinkHref("//example.test/source"), null);
  assert.equal(safeLinkHref("https://example.test/\u0000source"), null);
});
