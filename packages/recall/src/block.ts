// 検索結果をプロンプトに差し込む形にする

export type Hit = {
  path: string;
  startLine: number;
  snippet: string;
};

// 記憶ファイルからの関連する記憶。答えに使い、無いことは言わない
const HEADING = "Relevant memory from the user's memory files:";

/** 上から順に足して、合計文字数を超える手前で止める。1 件も入らなければ空 */
export const buildBlock = (hits: readonly Hit[], maxChars: number): string => {
  const lines: string[] = [];
  let used = 0;

  for (const hit of hits) {
    // 記憶ファイルの行は箇条書きのことが多い。頭の記号は外して、こちらの箇条書きに揃える
    const text = hit.snippet.trim().replace(/^[-*]\s+/, "");
    const line = `- ${text} (${hit.path}:${hit.startLine})`;
    if (used + line.length > maxChars) break;

    lines.push(line);
    used += line.length;
  }

  return lines.length === 0 ? "" : [HEADING, ...lines].join("\n");
};
