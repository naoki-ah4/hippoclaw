import type { Utterance } from "./transcript.ts";

export type BatchOptions = {
  /** 目安。1 発言がこれを超えるのは許す */
  maxInputChars: number;
  /** 0 なら assistant 発言は渡さない */
  assistantHead: number;
  /** 強制。これより長い発言は切り分ける */
  hardMaxChars: number;
};

/** ターン終了で要約するかの物差し。assistant の長さは数えない */
export const userChars = (utterances: readonly Utterance[]): number =>
  utterances.filter((u) => u.role === "user").reduce((n, u) => n + u.text.length, 0);

const splitEvery = (text: string, size: number): string[] => {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
};

const toLines = (u: Utterance, opts: BatchOptions): string[] => {
  const prefix = u.role === "user" ? "user: " : "assistant: ";
  const body = u.role === "user" ? u.text : u.text.slice(0, opts.assistantHead);
  if (body.length === 0) return [];

  return splitEvery(body, Math.max(1, opts.hardMaxChars - prefix.length)).map((part) => prefix + part);
};

export const buildBatches = (utterances: readonly Utterance[], opts: BatchOptions): string[] => {
  const softLimit = Math.min(opts.maxInputChars, opts.hardMaxChars);
  const batches: string[] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const u of utterances) {
    for (const line of toLines(u, opts)) {
      // 行の間の改行も 1 字として数える
      const cost = line.length + 1;
      if (current.length > 0 && currentChars + cost > softLimit) {
        batches.push(current.join("\n"));
        current = [];
        currentChars = 0;
      }

      current.push(line);
      currentChars += cost;
    }
  }
  if (current.length > 0) batches.push(current.join("\n"));

  return batches;
};
