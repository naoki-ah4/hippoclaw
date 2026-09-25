import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MemoryFiles } from "../src/files.ts";

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "hippoclaw-memory-"));
  await mkdir(path.join(root, "memory", "dreaming"), { recursive: true });
  await writeFile(path.join(root, "MEMORY.md"), "# MEMORY\n\n- 車はプリウス\n");
  await writeFile(path.join(root, "memory", "2026-09-20.md"), "# 2026-09-20\n\n温泉の話をした。\n\n夕飯はカレー。\n");
  await writeFile(path.join(root, "memory", "dreaming", "light.md"), "機械生成の見本\n");
  await writeFile(path.join(root, "notes.md"), "対象外\n");
  return root;
}

test("include の glob に当たるファイルだけを列挙する", async () => {
  const files = new MemoryFiles({ rootDir: await workspace(), include: ["MEMORY.md", "memory/*.md"], exclude: [] });
  assert.deepEqual(await files.list(), ["MEMORY.md", "memory/2026-09-20.md"]);
});

test("exclude は include より優先する", async () => {
  const files = new MemoryFiles({ rootDir: await workspace(), include: ["memory/**/*.md"], exclude: ["memory/dreaming/**"] });
  assert.deepEqual(await files.list(), ["memory/2026-09-20.md"]);
});

test("read は指定行から読み、続きがあれば nextFrom を返す", async () => {
  const files = new MemoryFiles({ rootDir: await workspace(), include: ["memory/*.md"], exclude: [] });
  const head = await files.read("memory/2026-09-20.md", { from: 1, lines: 2 });
  assert.equal(head.status, "ok");
  if (head.status !== "ok") return;
  assert.equal(head.text, "# 2026-09-20\n");
  assert.equal(head.nextFrom, 3);
  const tail = await files.read("memory/2026-09-20.md", { from: 3, lines: 10 });
  assert.equal(tail.status, "ok");
  if (tail.status !== "ok") return;
  assert.equal(tail.nextFrom, undefined);
});

test("対象外のパスと workspace の外は not_found", async () => {
  const files = new MemoryFiles({ rootDir: await workspace(), include: ["memory/*.md"], exclude: [] });
  assert.equal((await files.read("notes.md")).status, "not_found");
  assert.equal((await files.read("../etc/passwd")).status, "not_found");
  assert.equal((await files.read("/etc/passwd")).status, "not_found");
});
