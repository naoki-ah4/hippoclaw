// 意味検索の部品（索引と埋め込み）をプロセスで一つずつ持つ。
// OpenClaw は register を何度も呼び、検索の入口と service の stop を別の register から使うので、
// register の中ではなくモジュールに置く。正しさは stop に頼らず、設定の中身を鍵にする
import { resolveAgentDir } from "openclaw/plugin-sdk/agent-runtime";
import type { OpenClawConfig } from "openclaw/plugin-sdk/plugin-entry";
import { embedderFor, type Embedder } from "./embed.ts";
import type { SemanticDeps } from "./store.ts";
import { VectorIndex } from "./vector-index.ts";

/** stop の後、閉じるまで待つ時間。その瞬間に走っている検索が、閉じた索引を掴まないように */
const CLOSE_GRACE_MS = 30_000;

/** agent の state ディレクトリごとの索引 */
const indexes = new Map<string, Promise<VectorIndex>>();
/** agent と埋め込みの設定の組ごとの、埋め込みの作り方 */
const embedders = new Map<string, () => Promise<Embedder>>();

const indexFor = (stateDir: string): Promise<VectorIndex> => {
  let index = indexes.get(stateDir);
  if (!index) {
    index = VectorIndex.open(stateDir);
    indexes.set(stateDir, index);
    // 開けなかった物は覚えない。次の検索で開き直す
    index.catch(() => {
      if (indexes.get(stateDir) === index) indexes.delete(stateDir);
    });
  }
  return index;
};

/** agent の意味検索の部品。memory.search に provider が無ければ undefined（語の一致だけで探す） */
export const semanticFor = (cfg: OpenClawConfig, agentId: string): SemanticDeps | undefined => {
  const stateDir = resolveAgentDir(cfg, agentId);
  const source = embedderFor(cfg, agentId, stateDir);
  if (!source) return undefined;

  const key = `${agentId}\u0000${source.key}`;
  let openEmbedder = embedders.get(key);
  if (!openEmbedder) {
    openEmbedder = source.open;
    embedders.set(key, openEmbedder);
  }

  return { openIndex: () => indexFor(stateDir), openEmbedder };
};

/** 持っている部品を手放す。索引は少し待ってから閉じる。次の検索は新しく作る */
export const releaseSemantic = (): void => {
  for (const index of indexes.values()) {
    const timer = setTimeout(() => {
      void index.then((i) => i.close()).catch(() => {});
    }, CLOSE_GRACE_MS);
    timer.unref();
  }
  indexes.clear();
  embedders.clear();
};
