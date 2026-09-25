export type SearchHit = {
  path: string;
  startLine: number;
  endLine: number;
  /** 0〜1。大きいほど近い */
  score: number;
  text: string;
};

export type SearchOptions = {
  maxResults: number;
};

export interface Search {
  search(query: string, opts: SearchOptions): Promise<SearchHit[]>;
}
