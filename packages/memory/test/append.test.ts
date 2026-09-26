import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { appendLines, appendMemory } from "../src/append.ts";

const at = new Date(2026, 8, 26, 9, 5);

test("無ければ日付の見出しから作る", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hippoclaw-memory-"));
  const result = await appendMemory(root, "車はプリウス", at);

  assert.deepEqual(result, { path: "memory/2026-09-26.md", line: "- 車はプリウス" });
  assert.equal(await readFile(path.join(root, result.path), "utf8"), "# 2026-09-26\n\n- 車はプリウス\n");
});

test("あれば末尾に足す。改行は 1 行に潰す。同じ行は二度書かない", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hippoclaw-memory-"));
  await appendMemory(root, "一つ目", at);
  await appendMemory(root, "  二つ目\n  続き  ", at);
  const again = await appendMemory(root, "一つ目", at);

  assert.equal(again.line, "");
  assert.equal(
    await readFile(path.join(root, "memory/2026-09-26.md"), "utf8"),
    "# 2026-09-26\n\n- 一つ目\n- 二つ目 続き\n",
  );
});

test("dedupe なら既にある行と同じ物は捨てる", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hippoclaw-memory-"));

  const first = await appendLines(root, ["車はプリウス", "好きな温泉は道後"], { now: at, dedupe: true });
  assert.deepEqual(first, { path: "memory/2026-09-26.md", lines: ["- 車はプリウス", "- 好きな温泉は道後"], skipped: 0 });

  const second = await appendLines(root, ["好きな温泉は道後", "犬の名前はポチ", "犬の名前はポチ"], { now: at, dedupe: true });
  assert.deepEqual(second, { path: "memory/2026-09-26.md", lines: ["- 犬の名前はポチ"], skipped: 2 });

  assert.equal(
    await readFile(path.join(root, "memory/2026-09-26.md"), "utf8"),
    "# 2026-09-26\n\n- 車はプリウス\n- 好きな温泉は道後\n- 犬の名前はポチ\n",
  );
});
