import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBatches, userChars } from "../src/batch.ts";

const u = (role: "user" | "assistant", text: string, seq = 1) => ({ seq, role, text });

test("user 発言の文字数だけを数える", () => {
  assert.equal(userChars([u("user", "abcd"), u("assistant", "xxxxxxxx"), u("user", "ef")]), 6);
});

test("assistant は先頭だけ渡し、上限を超える手前で切る", () => {
  const batches = buildBatches(
    [u("user", "一つ目の発言"), u("assistant", "長い説明".repeat(50)), u("user", "二つ目の発言")],
    { maxInputChars: 40, assistantHead: 8, hardMaxChars: 1000 },
  );

  assert.deepEqual(batches, ["user: 一つ目の発言\nassistant: 長い説明長い説明", "user: 二つ目の発言"]);
});

test("目安を超える 1 発言はそのまま。強制の線を超える発言は切り分ける", () => {
  const long = "あ".repeat(50);
  const soft = buildBatches([u("user", long)], { maxInputChars: 20, assistantHead: 0, hardMaxChars: 1000 });
  assert.deepEqual(soft, [`user: ${long}`]);

  const hard = buildBatches([u("user", long)], { maxInputChars: 20, assistantHead: 0, hardMaxChars: 30 });
  assert.equal(hard.length, 3);
  assert.ok(hard.every((b) => b.length <= 30));
  assert.equal(hard.map((b) => b.replace(/^user: /, "")).join(""), long);
});

test("空なら空", () => {
  assert.deepEqual(buildBatches([], { maxInputChars: 100, assistantHead: 10, hardMaxChars: 1000 }), []);
});
