// transcript を読む口。OpenClaw の型無しの入口をここだけで使い、外には発言の列と cursor だけを見せる
import { readSessionTranscriptVisibleMessageDelta } from "openclaw/plugin-sdk/session-transcript-runtime";
import * as v from "valibot";

export type Utterance = {
  seq: number;
  role: "user" | "assistant";
  text: string;
};

export type Delta =
  /** 前回の続き。cursor は次回に渡す物 */
  | { kind: "page"; utterances: Utterance[]; cursor: string; hasMore: boolean }
  /** 手元の cursor が使えなくなった。返された cursor で先頭から読み直す */
  | { kind: "restart"; cursor: string }
  /** transcript が無いか、まだ読めない */
  | { kind: "none" };

const textPart = v.object({ type: v.literal("text"), text: v.string() });
const messageSchema = v.object({
  runtimeContextCarrier: v.optional(v.boolean()),
  content: v.union([v.string(), v.array(v.unknown())]),
});

/** message.content から本文だけを取り出す。OpenClaw が足す内部文脈と時刻の飾りは外す */
const textOf = (message: unknown): string => {
  const parsed = v.safeParse(messageSchema, message);
  if (!parsed.success || parsed.output.runtimeContextCarrier === true) return "";

  const { content } = parsed.output;
  const raw = typeof content === "string" ? content : content.flatMap((part) => (v.is(textPart, part) ? [part.text] : [])).join("");

  return raw
    .replace(/<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>[\s\S]*?<<<END_OPENCLAW_INTERNAL_CONTEXT>>>/g, "")
    .replace(/^\[[^\]\n]*\]\s*/, "")
    .replace(/\n\nRuntime:[\s\S]*$/, "")
    .trim();
};

export const readDelta = async (
  params: {
    agentId: string;
    sessionId: string;
    cursor?: string | undefined;
    maxMessages: number;
    /** これより前の発言は落とす（ms）。時刻が無い発言は残す */
    since?: number | undefined;
  },
  read = readSessionTranscriptVisibleMessageDelta,
): Promise<Delta> => {
  const result = await read({
    agentId: params.agentId,
    sessionId: params.sessionId,
    maxMessages: params.maxMessages,
    ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
  });

  if (result.kind === "reset") return { kind: "restart", cursor: result.cursor };
  if (result.kind !== "page") return { kind: "none" };

  const utterances: Utterance[] = [];
  for (const entry of result.entries) {
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    if (params.since !== undefined && entry.createdAt && Date.parse(entry.createdAt) < params.since) continue;

    const text = textOf(entry.message);
    if (text) utterances.push({ seq: entry.seq, role: entry.role, text });
  }

  return { kind: "page", utterances, cursor: result.cursor, hasMore: result.hasMore };
};
