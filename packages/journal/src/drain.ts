import { appendLines } from "@hippoclaw/memory/append";
import { buildBatches, userChars } from "./batch.ts";
import type { JournalConfig } from "./config.ts";
import type { Marks } from "./marks.ts";
import { summarize } from "./summarize.ts";
import { readDelta } from "./transcript.ts";

const READ_MAX_MESSAGES = 200;

const pad = (n: number): string => String(n).padStart(2, "0");
/** ローカル時刻の YYYY-MM-DD。記憶ファイルの日付と揃える */
const todayOf = (now: Date): string => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DrainTarget = {
  agentId: string;
  sessionId: string;
  rootDir: string;
  hardMaxChars: number;
};

export type DrainDeps = {
  marks: Pick<Marks, "lookup" | "register">;
  llm: Parameters<typeof summarize>[0];
  log: (message: string) => void;
  read?: Parameters<typeof readDelta>[1];
};

/**
 * 未要約分が尽きるまで要約して追記する。cursor は 1 ページ分の追記が終わった時だけ進める。
 * 途中で失敗したら投げる。そのページは次の回に頭から読み直し、重複は追記側で捨てる
 */
export const drain = async (target: DrainTarget, minUserChars: number, config: JournalConfig, deps: DrainDeps): Promise<void> => {
  const key = `${target.agentId}/${target.sessionId}`;
  let cursor = (await deps.marks.lookup(key))?.cursor;

  while (true) {
    const delta = await readDelta(
      {
        agentId: target.agentId,
        sessionId: target.sessionId,
        cursor,
        maxMessages: READ_MAX_MESSAGES,
        since: Date.now() - config.maxAgeDays * DAY_MS,
      },
      deps.read,
    );
    if (delta.kind === "none") return;
    if (delta.kind === "restart") {
      deps.log(`cursor restarted for ${key}`);
      cursor = delta.cursor;
      continue;
    }

    if (delta.utterances.length === 0 || userChars(delta.utterances) < minUserChars) return;

    for (const batch of buildBatches(delta.utterances, { ...config, hardMaxChars: target.hardMaxChars })) {
      const lines = await summarize(deps.llm, { batch, today: todayOf(new Date()), model: config.model });
      const result = await appendLines(target.rootDir, lines, { dedupe: true });
      deps.log(`${result.path} +${result.lines.length} (skipped ${result.skipped})`);
    }

    cursor = delta.cursor;
    await deps.marks.register(key, { cursor, at: Date.now() });
    if (!delta.hasMore) return;
  }
};
