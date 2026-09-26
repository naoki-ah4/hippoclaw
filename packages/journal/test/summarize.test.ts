import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize } from "../src/summarize.ts";

type Completer = Parameters<typeof summarize>[0];

/** 決まった文を返す偽のモデル。渡された物も覚える。ホストの返り値の他の欄は見ないので text だけ */
const fake = (reply: string) => {
  const calls: unknown[] = [];
  const llm = {
    async complete(params: unknown) {
      calls.push(params);
      return { text: reply };
    },
  } as unknown as Completer;
  return { calls, ...llm };
};

test("モデルの返事から箇条書きの行だけを拾う", async () => {
  const llm = fake("前置き\n- 車はプリウス\n\n- 好きな温泉は道後\n* 別記号\n-  \n");
  assert.deepEqual(await summarize(llm, { batch: "user: 車はプリウス", today: "2026-09-26" }), ["車はプリウス", "好きな温泉は道後"]);
});

test("バッチは user の発言として渡し、今日の日付を指示に入れる。model は指定した時だけ付く", async () => {
  const llm = fake("");
  await summarize(llm, { batch: "user: こんにちは", today: "2026-09-26", model: "ollama/gemma4:e2b-dev" });
  await summarize(llm, { batch: "user: こんにちは", today: "2026-09-26" });

  const [withModel, without] = llm.calls as Array<{ model?: string; systemPrompt: string; messages: Array<{ role: string; content: string }> }>;
  assert.equal(withModel?.model, "ollama/gemma4:e2b-dev");
  assert.equal(without?.model, undefined);
  assert.match(without?.systemPrompt ?? "", /Today is 2026-09-26\./);
  assert.deepEqual(without?.messages, [{ role: "user", content: "user: こんにちは" }]);
});
