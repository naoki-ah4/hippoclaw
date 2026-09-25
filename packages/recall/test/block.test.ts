import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBlock } from "../src/block.ts";

const hits = [
  { path: "MEMORY.md", startLine: 3, snippet: "- 車はプリウス。色は白。" },
  { path: "memory/2026-09-20.md", startLine: 5, snippet: "夕飯はカレー。" },
];

test("出典を付けて並べる", () => {
  assert.equal(
    buildBlock(hits, 1000),
    "Relevant memory from the user's memory files:\n- 車はプリウス。色は白。 (MEMORY.md:3)\n- 夕飯はカレー。 (memory/2026-09-20.md:5)",
  );
});

test("合計文字数を超える手前で止める", () => {
  const block = buildBlock(hits, 40);
  assert.ok(block.includes("プリウス"));
  assert.ok(!block.includes("カレー"));
});

test("1 件も入らなければ空", () => {
  assert.equal(buildBlock([], 1000), "");
  assert.equal(buildBlock(hits, 5), "");
});
