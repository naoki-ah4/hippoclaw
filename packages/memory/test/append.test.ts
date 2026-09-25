import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { appendMemory } from "../src/append.ts";

const at = new Date(2026, 8, 26, 9, 5);

test("無ければ日付の見出しから作る", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hippoclaw-append-"));
  const result = await appendMemory(root, "車はプリウス", at);

  assert.deepEqual(result, { path: "memory/2026-09-26.md", line: "- 09:05 車はプリウス" });
  assert.equal(await readFile(path.join(root, result.path), "utf8"), "# 2026-09-26\n\n- 09:05 車はプリウス\n");
});

test("あれば末尾に足す。改行は 1 行に潰す", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hippoclaw-append-"));
  await appendMemory(root, "一つ目", at);
  await appendMemory(root, "  二つ目\n  続き  ", new Date(2026, 8, 26, 21, 40));

  assert.equal(
    await readFile(path.join(root, "memory/2026-09-26.md"), "utf8"),
    "# 2026-09-26\n\n- 09:05 一つ目\n- 21:40 二つ目 続き\n",
  );
});
