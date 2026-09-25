// 語の一致で探す最小の実装。索引は持たず、毎回ファイルを読む
// 単位は空行以外の 1 行。検索語は Intl.Segmenter で分かち書きする
import type { Search, SearchHit, SearchOptions } from "./types/search.ts";

/** この実装が読む側に求める物。列挙と本文だけ */
export type SearchSource = {
  list(): Promise<string[]>;
  text(relPath: string): Promise<string | null>;
};

const segmenter = new Intl.Segmenter("ja", { granularity: "word" });

const hiraganaOnly = /^[\p{Script=Hiragana}ー]+$/u;

export const words = (text: string): string[] => {
  const out = new Set<string>();

  for (const s of segmenter.segment(text)) {
    if (s.isWordLike) out.add(s.segment.toLowerCase());
  }

  // ひらがなだけの語は助詞や助動詞がほとんどなので外す。全部そうなら外さない
  const content = [...out].filter((w) => !hiraganaOnly.test(w));

  return content.length > 0 ? content : [...out];
};

/** 行に含まれる検索語の割合。含まれなければ 0 */
const scoreLine = (line: string, terms: readonly string[]): number => {
  const lower = line.toLowerCase();
  const matched = terms.filter((t) => lower.includes(t)).length;

  return matched / terms.length;
};

export class WordMatchSearch implements Search {
  private readonly source: SearchSource;

  constructor(source: SearchSource) {
    this.source = source;
  }

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    const terms = words(query);
    if (terms.length === 0) return [];

    const hits: SearchHit[] = [];

    for (const relPath of await this.source.list()) {
      const text = await this.source.text(relPath);
      if (text === null) continue;

      text.split(/\r?\n/).forEach((line, i) => {
        if (line.trim() === "") return;

        const score = scoreLine(line, terms);
        if (score === 0) return;

        hits.push({ path: relPath, startLine: i + 1, endLine: i + 1, score, text: line });
      });
    }

    // 同点はファイル順、行順。list() がソート済みなので push の順が安定
    hits.sort((a, b) => b.score - a.score);

    return hits.slice(0, opts.maxResults);
  }
}
