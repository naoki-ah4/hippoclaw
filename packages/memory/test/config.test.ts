import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveConfig } from "../src/config.ts";

test("何も無ければ既定値", () => {
  assert.deepEqual(resolveConfig(undefined), { include: ["MEMORY.md", "memory/*.md"], exclude: [], maxResults: 6 });
});

test("指定した値はそのまま、空白は落とす", () => {
  const config = resolveConfig({ include: [" memory/**/*.md "], exclude: ["memory/dreaming/**"], maxResults: 3 });
  assert.deepEqual(config, { include: ["memory/**/*.md"], exclude: ["memory/dreaming/**"], maxResults: 3 });
});

test("範囲外や型違いは受け付けない", () => {
  assert.throws(() => resolveConfig({ maxResults: 0 }));
  assert.throws(() => resolveConfig({ maxResults: 2.5 }));
  assert.throws(() => resolveConfig({ include: [""] }));
  assert.throws(() => resolveConfig({ include: "MEMORY.md" }));
});
