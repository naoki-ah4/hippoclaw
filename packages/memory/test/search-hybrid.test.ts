import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import type { Embedder } from "../src/embed.ts";
import { MemoryFiles } from "../src/files.ts";
import { HybridSearch } from "../src/search-hybrid.ts";
import { VectorIndex } from "../src/vector-index.ts";

/** 文字の出現で作る偽のベクトル。同じ文字を多く共有する文ほど近い */
const charVector = (t: string): Float32Array => {
  const v = new Float32Array(32);
  for (const ch of t) {
    const i = (ch.codePointAt(0) ?? 0) % 32;
    v[i] = (v[i] ?? 0) + 1;
  }
  return v;
};

/** 偽の埋め込み。索引に入れた本文を calls に残す */
const fakeEmbed = (calls: string[][] = [], identity = "fake", vector = charVector) => async (): Promise<Embedder> => ({
  identity,
  documents: async (texts) => {
    calls.push([...texts]);
    return texts.map(vector);
  },
  query: async (text) => vector(text),
});

const setup = async (files: Record<string, string>) => {
  const root = await mkdtemp(path.join(tmpdir(), "hippoclaw-hybrid-"));
  await mkdir(path.join(root, "memory"), { recursive: true });
  for (const [rel, text] of Object.entries(files)) await writeFile(path.join(root, rel), text);

  const index = await VectorIndex.open(path.join(root, "state"));
  const source = new MemoryFiles({ rootDir: root, include: ["MEMORY.md", "memory/*.md"], exclude: [] });
  return { root, index, source };
};

test("意味と語の両方で探し、行と本文を返す", async () => {
  const { index, source } = await setup({
    "MEMORY.md": "# MEMORY\n\n- 車はフィット\n- 好きな温泉は道後\n",
    "memory/2026-09-26.md": "# 2026-09-26\n\n- 姉は大阪で看護師をしている\n",
  });
  const search = new HybridSearch(source, async () => index, fakeEmbed());

  const hits = await search.search("フィットの色", { maxResults: 2 });
  assert.equal(hits[0]?.path, "MEMORY.md");
  assert.equal(hits[0]?.startLine, 3);
  assert.equal(hits[0]?.text, "- 車はフィット");
  assert.ok((hits[0]?.score ?? 0) > (hits[1]?.score ?? 0));
  await index.close();
});

test("変わっていないファイルは埋め込み直さない。足した行だけ埋め込む", async () => {
  const { root, index, source } = await setup({ "MEMORY.md": "- 一つ目\n" });
  const calls: string[][] = [];
  const search = new HybridSearch(source, async () => index, fakeEmbed(calls));

  await search.search("一つ目", { maxResults: 3 });
  await search.search("一つ目", { maxResults: 3 });
  await writeFile(path.join(root, "MEMORY.md"), "- 一つ目\n- 二つ目\n");
  const hits = await search.search("二つ目", { maxResults: 3 });

  assert.deepEqual(calls, [["- 一つ目"], ["- 二つ目"]]);
  assert.equal(hits[0]?.text, "- 二つ目");
  await index.close();
});

test("消えたファイルの行は出てこない", async () => {
  const { root, index, source } = await setup({ "memory/a.md": "- 消える行\n", "MEMORY.md": "- 残る行\n" });
  const search = new HybridSearch(source, async () => index, fakeEmbed());

  await search.search("行", { maxResults: 5 });
  await writeFile(path.join(root, "memory/a.md"), "");
  const hits = await search.search("行", { maxResults: 5 });

  assert.deepEqual(hits.map((h) => h.text), ["- 残る行"]);
  await index.close();
});

test("モデルが変わったら埋め込みを作り直す", async () => {
  const { index, source } = await setup({ "MEMORY.md": "- 一つ目\n" });
  const calls: string[][] = [];

  await new HybridSearch(source, async () => index, fakeEmbed(calls, "model-a")).search("一つ目", { maxResults: 1 });
  await new HybridSearch(source, async () => index, fakeEmbed(calls, "model-b")).search("一つ目", { maxResults: 1 });

  assert.equal(calls.filter((c) => c.includes("- 一つ目")).length, 2);
  await index.close();
});

test("古い日付ファイルの行は減点する。MEMORY.md と今日の行は引かない", async () => {
  const { index, source } = await setup({
    "MEMORY.md": "- A\n",
    "memory/2026-09-26.md": "- B\n",
    "memory/2026-06-28.md": "- C\n",
  });
  // 質問からの近さは三つとも同じ。互いには重複とみなされない程度に離しておく
  const vectors: Record<string, number[]> = {
    q: [1, 0, 0, 0],
    "- A": [1, 0.3, 0, 0],
    "- B": [1, 0, 0.3, 0],
    "- C": [1, 0, 0, 0.3],
  };
  const embed = fakeEmbed([], "fake", (t) => Float32Array.from(vectors[t] ?? [0, 0, 0, 1]));
  const search = new HybridSearch(source, async () => index, embed, () => new Date(2026, 8, 26));

  const hits = await search.search("q", { maxResults: 3 });
  const byPath = Object.fromEntries(hits.map((h) => [h.path, h.score]));
  assert.ok(Math.abs((byPath["MEMORY.md"] ?? 0) - (byPath["memory/2026-09-26.md"] ?? 0)) < 1e-6);
  // 90 日前なら 0.1 × (1 − 0.5^3) = 0.0875 引かれる
  assert.ok(Math.abs((byPath["MEMORY.md"] ?? 0) - (byPath["memory/2026-06-28.md"] ?? 0) - 0.0875) < 1e-6);
  await index.close();
});

test("ほぼ同じ行は点の高い一つだけを返す。同じ本文が別のファイルにあっても一つ", async () => {
  const { index, source } = await setup({
    "MEMORY.md": "- 姉は大阪で看護師\n",
    "memory/2026-09-26.md": "- 姉は大阪で看護師\n- 姉は大阪で看護師。\n- 好きな温泉は道後\n",
  });
  const search = new HybridSearch(source, async () => index, fakeEmbed(), () => new Date(2026, 8, 26));

  const hits = await search.search("姉は大阪で看護師", { maxResults: 3 });
  assert.equal(hits.filter((h) => h.text.includes("看護師")).length, 1);
  assert.equal(hits[0]?.path, "MEMORY.md");
  await index.close();
});

test("直した行の前の本文は、索引から消える", async () => {
  const { root, index, source } = await setup({ "MEMORY.md": "- 車はプリウス\n" });
  const search = new HybridSearch(source, async () => index, fakeEmbed());

  await search.search("車", { maxResults: 3 });
  await writeFile(path.join(root, "MEMORY.md"), "- 車はフィット\n");
  await search.search("車", { maxResults: 3 });

  await index.close();
  const db = new DatabaseSync(path.join(root, "state", "hippoclaw-memory", "index.sqlite"), { readOnly: true });
  assert.deepEqual(
    db.prepare("SELECT text FROM texts").all().map((r) => r.text),
    ["- 車はフィット"],
  );
  db.close();
});
