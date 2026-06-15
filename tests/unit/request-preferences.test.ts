import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveLocalePreference,
  resolveThemePreference,
} from "@/lib/preferences";

test("accepts only supported locale cookie values", () => {
  assert.equal(resolveLocalePreference("ko"), "ko");
  assert.equal(resolveLocalePreference("en"), "en");
  assert.equal(resolveLocalePreference("ja"), null);
  assert.equal(resolveLocalePreference(undefined), null);
});

test("falls back to the system theme for invalid cookie values", () => {
  assert.equal(resolveThemePreference("light"), "light");
  assert.equal(resolveThemePreference("dark"), "dark");
  assert.equal(resolveThemePreference("system"), "system");
  assert.equal(resolveThemePreference("midnight"), "system");
  assert.equal(resolveThemePreference(undefined), "system");
});
