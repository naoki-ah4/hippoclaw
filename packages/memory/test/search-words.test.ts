import assert from "node:assert/strict";
import { test } from "node:test";
import { WordMatchSearch, words } from "../src/search-words.ts";

const source = {
  async list() {
    return ["MEMORY.md", "memory/2026-09-20.md"];
  },
  async text(relPath: string) {
    return {
      "MEMORY.md": "# MEMORY\n\n- 車はプリウス。色は白\n- 犬の名前はポチ\n",
      "memory/2026-09-20.md": "# 2026-09-20\n\n温泉の話をした。道後にまた行きたいと言っていた。\n\n夕飯はカレー。\n",
    }[relPath] ?? null;
  },
};

test("検索語は分かち書きして小文字に揃え、ひらがなだけの語は外す", () => {
  assert.deepEqual(words("プリウスの色は？"), ["プリウス", "色"]);
  assert.deepEqual(words("Prius Color"), ["prius", "color"]);
  assert.deepEqual(words("ただいま"), ["ただいま"]);
});

test("含まれる語が多い行ほど上に来る", async () => {
  const hits = await new WordMatchSearch(source).search("プリウスの色は？", { maxResults: 10 });
  assert.equal(hits[0]?.path, "MEMORY.md");
  assert.equal(hits[0]?.startLine, 3);
  assert.equal(hits[0]?.endLine, 3);
  assert.ok((hits[0]?.score ?? 0) > (hits[1]?.score ?? 0));
});

test("助詞だけの行は当たらない", async () => {
  const hits = await new WordMatchSearch(source).search("プリウスの色は？", { maxResults: 10 });
  assert.deepEqual(
    hits.map((h) => h.path + ":" + h.startLine),
    ["MEMORY.md:3"],
  );
});

test("当たらなければ空、maxResults で切る", async () => {
  const search = new WordMatchSearch(source);
  assert.deepEqual(await search.search("宇宙船", { maxResults: 10 }), []);
  assert.equal((await search.search("温泉 カレー", { maxResults: 1 })).length, 1);
});
