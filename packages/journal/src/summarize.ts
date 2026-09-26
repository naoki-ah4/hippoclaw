// 会話のバッチを、覚えておく価値のある事実の箇条書きにする。モデルにやらせるのはここだけ
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";

/** api.runtime.llm をそのまま渡す */
type Completer = Pick<OpenClawPluginApi["runtime"]["llm"], "complete">;

// 会話の抜粋から、後で思い出す価値のある事実だけを箇条書きにする。1 行 1 事実、「- 」で始める。
// 記録するのは user が言ったことだけ。各行はそれだけで読めるように書く:
// user 以外のことなら主語を書く、「項目: 値」のラベル書きや丁寧語にしない、相対的な日付は今日を基に暦の日付に直す。
// 人・好み・決めたこと・日付・予定・持ち物。挨拶や相槌は書かない。無ければ何も書かない
const instruction = (today: string): string =>
  [
    "You will be given lines from a conversation. Lines starting with \"user:\" are what the user said.",
    `Today is ${today}.`,
    "Write only the facts the user stated that are worth remembering later, one per line, each line starting with \"- \".",
    "Each line must make sense on its own:",
    "- Name the subject when the fact is not about the user (e.g. the user's sister). Facts about the user need no subject.",
    "- Write a short plain statement. No \"label: value\" lines, no polite endings.",
    "- Turn relative dates (tomorrow, next month on the 3rd) into full calendar dates using today's date.",
    "Keep: people, preferences, decisions, dates, plans, belongings. Skip: greetings, small talk.",
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
  params: { batch: string; today: string; model?: string | undefined },
): Promise<string[]> => {
  // agentId は渡さない。フックの中の completion は対象 agent に束縛されていて、上書きは拒まれる
  const { text } = await llm.complete({
    ...(params.model !== undefined ? { model: params.model } : {}),
    systemPrompt: instruction(params.today),
    messages: [{ role: "user", content: params.batch }],
    purpose: "hippoclaw-journal summary",
    temperature: 0.2,
  });

  return parseBullets(text);
};
