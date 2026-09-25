// 記憶ファイルの列挙と読み出し。対象は include と exclude の glob で決まる
import { glob, readFile } from "node:fs/promises";
import path from "node:path";

export type FilesOptions = {
  rootDir: string;
  include: readonly string[];
  exclude: readonly string[];
};

export type ReadOptions = {
  from?: number | undefined;
  lines?: number | undefined;
};

export type ReadResult =
  | { status: "ok"; path: string; text: string; from: number; lines: number; nextFrom?: number }
  | { status: "not_found"; path: string };

const DEFAULT_READ_LINES = 120;
const MAX_READ_LINES = 400;

export class MemoryFiles {
  private readonly options: FilesOptions;

  constructor(options: FilesOptions) {
    this.options = options;
  }

  get rootDir(): string {
    return this.options.rootDir;
  }

  /** 対象ファイルの workspace 相対パス。ソート済み */
  async list(): Promise<string[]> {
    const { rootDir: cwd, include, exclude } = this.options;

    return (await Array.fromAsync(glob(include, { cwd, exclude }))).sort();
  }

  /** 本文。消えていれば null */
  async text(relPath: string): Promise<string | null> {
    try {
      return await readFile(path.join(this.options.rootDir, relPath), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  /** 指定行から読む。list() に無いパスは not_found */
  async read(relPath: string, opts?: ReadOptions): Promise<ReadResult> {
    const text = (await this.list()).includes(relPath) ? await this.text(relPath) : null;
    if (text === null) return { status: "not_found", path: relPath };

    const all = text.split(/\r?\n/);
    const from = Math.max(1, Math.floor(opts?.from ?? 1));
    const lines = Math.min(MAX_READ_LINES, Math.max(1, Math.floor(opts?.lines ?? DEFAULT_READ_LINES)));
    const slice = all.slice(from - 1, from - 1 + lines);
    const rest = all.length - (from - 1 + slice.length);

    return {
      status: "ok",
      path: relPath,
      text: slice.join("\n"),
      from,
      lines: slice.length,
      ...(rest > 0 ? { nextFrom: from + slice.length } : {}),
    };
  }
}
