import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { resolveConfig } from "../src/config.ts";
import { drain, type DrainDeps } from "../src/drain.ts";
import type { Mark } from "../src/marks.ts";

type Read = NonNullable<DrainDeps["read"]>;
type Result = Awaited<ReturnType<Read>>;

const config = resolveConfig({});
const today = () => {
  const d = new Date();
  return `memory/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.md`;
};

const userPage = (texts: string[], cursor: string, hasMore = false): Result => ({
  kind: "page",
  cursor,
  hasMore,
  entries: texts.map((text, i) => ({ entryId: `e${i}`, seq: i + 1, role: "user", message: { role: "user", content: text } })),
});

const setup = async (reply: string | Error) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "hippoclaw-drain-"));
  const store = new Map<string, Mark>();
  const reads: Array<string | undefined> = [];
  const deps = (read: Read): DrainDeps => ({
    marks: {
      async lookup(key) {
        return store.get(key);
      },
      async register(key, mark) {
        store.set(key, mark);
      },
    },
    llm: {
      async complete() {
        if (reply instanceof Error) throw reply;
        return { text: reply };
      },
    } as unknown as DrainDeps["llm"],
    log: () => {},
    read: async (params) => {
      reads.push(params.cursor);
      return read(params);
    },
  });
  return { rootDir, store, reads, deps, target: { agentId: "main", sessionId: "s1", rootDir, hardMaxChars: 4000 } };
};

test("要約を追記して、cursor をページの終わりに進める", async () => {
  const { rootDir, store, deps, target } = await setup("- 車はプリウス");
  await drain(target, 1, config, deps(async () => userPage(["車はプリウスだよ"], "c1")));

  assert.match(await readFile(path.join(rootDir, today()), "utf8"), /- 車はプリウス\n/);
  assert.equal(store.get("main/s1")?.cursor, "c1");
});

test("続きがあれば次のページも読む。前回の cursor から始める", async () => {
  const { store, reads, deps, target } = await setup("- 事実");
  store.set("main/s1", { cursor: "c0", at: Date.now() });
  const pages = [userPage(["一つ目"], "c1", true), userPage(["二つ目"], "c2")];
  await drain(target, 1, config, deps(async () => pages.shift() ?? { kind: "missing" }));

  assert.deepEqual(reads, ["c0", "c1"]);
  assert.equal(store.get("main/s1")?.cursor, "c2");
});

test("user の文字数が閾値に届かなければ何もしない", async () => {
  const { store, deps, target } = await setup("- 事実");
  await drain(target, 100, config, deps(async () => userPage(["短い"], "c1")));

  assert.equal(store.get("main/s1"), undefined);
});

test("cursor が使えなければ、返された cursor で読み直す", async () => {
  const { store, reads, deps, target } = await setup("- 事実");
  store.set("main/s1", { cursor: "stale", at: Date.now() });
  const results: Result[] = [{ kind: "reset", cursor: "fresh", reason: "generation_mismatch" }, userPage(["本文"], "c1")];
  await drain(target, 1, config, deps(async () => results.shift() ?? { kind: "missing" }));

  assert.deepEqual(reads, ["stale", "fresh"]);
  assert.equal(store.get("main/s1")?.cursor, "c1");
});

test("要約に失敗したら投げて、cursor は進めない", async () => {
  const { store, deps, target } = await setup(new Error("model unavailable"));
  store.set("main/s1", { cursor: "c0", at: 1 });

  await assert.rejects(drain(target, 1, config, deps(async () => userPage(["本文"], "c1"))), /model unavailable/);
  assert.equal(store.get("main/s1")?.cursor, "c0");
});
