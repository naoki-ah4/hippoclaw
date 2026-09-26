// 最後に書き込みまで成功した cursor の置き場。agent の state ディレクトリの下の sqlite
// （OpenClaw の keyed store は信頼済みプラグインにしか開かれていない）
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Mark = { cursor: string; at: number };

export type MarksOptions = {
  /** これより古い項目は捨てる。その期間より古い発言は要約しないので、失う物は無い */
  maxAgeMs?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export class Marks {
  private readonly db: DatabaseSync;
  private readonly maxAgeMs: number;

  constructor(stateDir: string, options: MarksOptions = {}) {
    const dir = path.join(stateDir, "hippoclaw-journal");
    mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(path.join(dir, "marks.sqlite"));
    this.db.exec("CREATE TABLE IF NOT EXISTS marks (key TEXT PRIMARY KEY, cursor TEXT NOT NULL, at INTEGER NOT NULL) STRICT");
    this.maxAgeMs = options.maxAgeMs ?? 30 * DAY_MS;
  }

  async lookup(key: string): Promise<Mark | undefined> {
    const row = this.db.prepare("SELECT cursor, at FROM marks WHERE key = ?").get(key) as { cursor: string; at: number } | undefined;

    return row ? { cursor: row.cursor, at: row.at } : undefined;
  }

  async register(key: string, mark: Mark): Promise<void> {
    this.db.prepare("INSERT OR REPLACE INTO marks (key, cursor, at) VALUES (?, ?, ?)").run(key, mark.cursor, mark.at);
    this.db.prepare("DELETE FROM marks WHERE at < ?").run(mark.at - this.maxAgeMs);
  }

  close(): void {
    this.db.close();
  }
}
