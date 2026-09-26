// 記憶ファイルへの追記。人（/remember）、モデル（memory_append）、journal の要約がここを通る
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const pad = (n: number): string => String(n).padStart(2, "0");

/** ローカル時刻の YYYY-MM-DD。TZ はプロセスの物 */
const dateOf = (now: Date): string => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export type AppendOptions = {
  now?: Date;
  /** 既にある行は捨てる */
  dedupe?: boolean;
};

export type AppendResult = {
  path: string;
  lines: string[];
  skipped: number;
};

/** memory/YYYY-MM-DD.md に行を足す。ファイルが無ければ日付の見出しから作る。改行は 1 行に潰す */
export const appendLines = async (rootDir: string, texts: readonly string[], opts: AppendOptions = {}): Promise<AppendResult> => {
  const date = dateOf(opts.now ?? new Date());
  const relPath = `memory/${date}.md`;
  const absPath = path.join(rootDir, relPath);

  await mkdir(path.dirname(absPath), { recursive: true });
  const existing = await readFile(absPath, "utf8").catch(() => null);
  const known = new Set((existing ?? "").split(/\r?\n/).map((l) => l.replace(/^-\s+/, "").trim()));

  const cleaned = [...new Set(texts.map((t) => t.trim().replace(/\s*\n\s*/g, " ")).filter(Boolean))];
  const fresh = opts.dedupe ? cleaned.filter((t) => !known.has(t)) : cleaned;
  if (fresh.length === 0) return { path: relPath, lines: [], skipped: texts.length };

  const lines = fresh.map((t) => `- ${t}`);
  const head = existing === null ? `# ${date}\n\n` : existing.endsWith("\n") ? "" : "\n";
  await appendFile(absPath, `${head}${lines.join("\n")}\n`, "utf8");

  return { path: relPath, lines, skipped: texts.length - fresh.length };
};

/** /remember と memory_append。1 行足す。同じ行が既にあれば書かない */
export const appendMemory = async (rootDir: string, text: string, now = new Date()): Promise<{ path: string; line: string }> => {
  const { path: relPath, lines } = await appendLines(rootDir, [text], { now, dedupe: true });

  return { path: relPath, line: lines[0] ?? "" };
};
