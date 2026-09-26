// 意味の近さと語の一致を合わせて探す。スコアは索引の SQL が出す
import type { Embedder } from "./embed.ts";
import { words } from "./search-words.ts";
import type { Search, SearchHit, SearchOptions } from "./types/search.ts";
import type { IndexSource, VectorIndex } from "./vector-index.ts";

const pad = (n: number): string => String(n).padStart(2, "0");
const dateOf = (now: Date): string => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export class HybridSearch implements Search {
  private readonly source: IndexSource;
  private readonly openIndex: () => Promise<VectorIndex>;
  private readonly openEmbedder: () => Promise<Embedder>;
  private readonly now: () => Date;

  /** 索引も埋め込みも作るのに await が要るので、使う時に開く */
  constructor(source: IndexSource, openIndex: () => Promise<VectorIndex>, openEmbedder: () => Promise<Embedder>, now = () => new Date()) {
    this.source = source;
    this.openIndex = openIndex;
    this.openEmbedder = openEmbedder;
    this.now = now;
  }

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    if (query.trim() === "") return [];

    const [index, embedder] = await Promise.all([this.openIndex(), this.openEmbedder()]);
    await index.sync(this.source, embedder);
    const vector = await embedder.query(query);

    return await index.search(vector, words(query), opts.maxResults, dateOf(this.now()));
  }
}
