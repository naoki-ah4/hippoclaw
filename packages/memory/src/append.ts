// 記憶ファイルへの追記。人（/remember）とモデル（memory_append）の両方がここを通る
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const pad = (n: number): string => String(n).padStart(2, "0");

/** ローカル時刻の YYYY-MM-DD と HH:MM。TZ はプロセスの物 */
const stamp = (now: Date) => ({
  date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
});

export type AppendResult = {
  path: string;
  line: string;
};

/** memory/YYYY-MM-DD.md に 1 行足す。ファイルが無ければ日付の見出しから作る */
export const appendMemory = async (rootDir: string, text: string, now = new Date()): Promise<AppendResult> => {
  const { date, time } = stamp(now);
  const relPath = `memory/${date}.md`;
  const absPath = path.join(rootDir, relPath);
  const line = `- ${time} ${text.trim().replace(/\s*\n\s*/g, " ")}`;

  await mkdir(path.dirname(absPath), { recursive: true });
  const existing = await readFile(absPath, "utf8").catch(() => null);
  const head = existing === null ? `# ${date}\n\n` : existing.endsWith("\n") ? "" : "\n";
  await appendFile(absPath, `${head}${line}\n`, "utf8");

  return { path: relPath, line };
};
