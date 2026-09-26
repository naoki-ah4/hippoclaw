// 会話のバッチを、覚えておく価値のある事実の箇条書きにする。モデルにやらせるのはここだけ
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";

/** api.runtime.llm をそのまま渡す */
type Completer = Pick<OpenClawPluginApi["runtime"]["llm"], "complete">;

// 会話の抜粋から、後で思い出す価値のある事実だけを箇条書きにする。1 行 1 事実、「- 」で始める。
// 人・好み・決めたこと・日付・予定・持ち物。挨拶や相槌、assistant の説明は書かない。無ければ何も書かない
const INSTRUCTION = [
  "You will be given an excerpt of a conversation between a user and an assistant.",
  "Write only the facts worth remembering later, one per line, each line starting with \"- \".",
  "Keep: people, preferences, decisions, dates, plans, belongings. Skip: greetings, small talk, the assistant's explanations.",
  "Write in the user's language. If there is nothing worth remembering, output nothing.",
].join("\n");

/** 箇条書きの行だけを取り出す */
const parseBullets = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter((l) => l.length > 0);

export const summarize = async (
  llm: Completer,
  params: { batch: string; model?: string | undefined },
): Promise<string[]> => {
  // agentId は渡さない。フックの中の completion は対象 agent に束縛されていて、上書きは拒まれる
  const { text } = await llm.complete({
    ...(params.model !== undefined ? { model: params.model } : {}),
    systemPrompt: INSTRUCTION,
    messages: [{ role: "user", content: params.batch }],
    purpose: "hippoclaw-journal summary",
    temperature: 0.2,
  });

  return parseBullets(text);
};
