// workspace ひとつ分の記憶。ファイルと検索の組
import type { MemoryConfig } from "./config.ts";
import { MemoryFiles } from "./files.ts";
import { WordMatchSearch } from "./search-words.ts";
import type { Search } from "./types/search.ts";

export type MemoryStore = {
  files: MemoryFiles;
  search: Search;
};

export const createStore = (rootDir: string, config: MemoryConfig): MemoryStore => {
  const files = new MemoryFiles({ rootDir, include: config.include, exclude: config.exclude });

  return { files, search: new WordMatchSearch(files) };
};
