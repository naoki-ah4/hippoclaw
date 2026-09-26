// workspace ひとつ分の記憶。ファイルと検索の組
import type { MemoryConfig } from "./config.ts";
import type { Embedder } from "./embed.ts";
import { MemoryFiles } from "./files.ts";
import { HybridSearch } from "./search-hybrid.ts";
import { WordMatchSearch } from "./search-words.ts";
import type { Search } from "./types/search.ts";
import type { VectorIndex } from "./vector-index.ts";

export type MemoryStore = {
  files: MemoryFiles;
  search: Search;
};

export type SemanticDeps = {
  openIndex: () => Promise<VectorIndex>;
  openEmbedder: () => Promise<Embedder>;
};

/** 索引と埋め込みがあれば意味検索、無ければ語の一致 */
export const createStore = (rootDir: string, config: MemoryConfig, semantic?: SemanticDeps): MemoryStore => {
  const files = new MemoryFiles({ rootDir, include: config.include, exclude: config.exclude });
  const search = semantic ? new HybridSearch(files, semantic.openIndex, semantic.openEmbedder) : new WordMatchSearch(files);

  return { files, search };
};
