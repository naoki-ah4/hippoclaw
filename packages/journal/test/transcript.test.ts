import assert from "node:assert/strict";
import { test } from "node:test";
import { readDelta } from "../src/transcript.ts";

type Read = NonNullable<Parameters<typeof readDelta>[1]>;
type Result = Awaited<ReturnType<Read>>;

const entry = (seq: number, role: string, content: unknown, createdAt?: string) => ({
  entryId: `e${seq}`,
  seq,
  role,
  message: { role, content },
  ...(createdAt ? { createdAt } : {}),
});

const page = (entries: ReturnType<typeof entry>[]): Result => ({ kind: "page", cursor: "next", entries, hasMore: false });
const scope = { agentId: "main", sessionId: "s1", maxMessages: 10 };

test("user と assistant の本文だけを、飾りを外して並べる", async () => {
  const read: Read = async () =>
    page([
      entry(1, "user", "[Sat 2026-09-26 09:05 GMT+9] プリウスの色は？\n\nRuntime: x"),
      entry(2, "assistant", [{ type: "thinking", thinking: "…" }, { type: "text", text: "白です" }]),
      entry(3, "toolResult", "ignored"),
      entry(4, "user", { runtimeContextCarrier: true, content: "文脈" }),
      entry(5, "user", "   "),
    ]);

  assert.deepEqual(await readDelta(scope, read), {
    kind: "page",
    cursor: "next",
    hasMore: false,
    utterances: [
      { seq: 1, role: "user", text: "プリウスの色は？" },
      { seq: 2, role: "assistant", text: "白です" },
    ],
  });
});

test("since より古い発言は落とす。時刻が無い発言は残す", async () => {
  const read: Read = async () =>
    page([
      entry(1, "user", "古い", "2026-08-01T00:00:00Z"),
      entry(2, "user", "新しい", "2026-09-26T00:00:00Z"),
      entry(3, "user", "時刻なし"),
    ]);

  const delta = await readDelta({ ...scope, since: Date.parse("2026-09-01T00:00:00Z") }, read);
  assert.equal(delta.kind, "page");
  if (delta.kind !== "page") return;
  assert.deepEqual(delta.utterances.map((u) => u.text), ["新しい", "時刻なし"]);
});

test("cursor が使えなければ restart、無ければ none。cursor は渡した物がそのまま届く", async () => {
  const seen: unknown[] = [];
  const reset: Read = async (params) => {
    seen.push(params.cursor);
    return { kind: "reset", cursor: "fresh", reason: "generation_mismatch" };
  };
  assert.deepEqual(await readDelta({ ...scope, cursor: "stale" }, reset), { kind: "restart", cursor: "fresh" });
  assert.deepEqual(seen, ["stale"]);

  const missing: Read = async () => ({ kind: "missing" });
  assert.deepEqual(await readDelta(scope, missing), { kind: "none" });
});
