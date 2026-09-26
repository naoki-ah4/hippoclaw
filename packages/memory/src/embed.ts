// 埋め込みは OpenClaw の memory.search の設定と、そこに登録された provider に任せる。
// ollama、OpenAI 互換、Gemini などの違いと鍵の解決は OpenClaw が持つ
import { getMemoryEmbeddingProvider } from "openclaw/plugin-sdk/memory-core-host-engine-embeddings";
import { resolveMemorySearchConfig } from "openclaw/plugin-sdk/memory-core-host-engine-foundation";
import type { OpenClawConfig } from "openclaw/plugin-sdk/plugin-entry";

export type Embedder = {
  /** これが変わったら索引の埋め込みを作り直す。provider と model */
  readonly identity: string;
  documents(texts: readonly string[]): Promise<Float32Array[]>;
  query(text: string): Promise<Float32Array>;
};

/**
 * memory.search に provider が書かれていれば、その埋め込みを作る関数を返す。無ければ undefined（語の一致だけで探す）。
 * provider の既定の "auto" は選ばない。memory-core はそこで OpenAI の鍵を探しに行くので、明示された時だけ使う
 */
export const embedderFor = (cfg: OpenClawConfig, agentId: string, agentDir: string): (() => Promise<Embedder>) | undefined => {
  const settings = resolveMemorySearchConfig(cfg, agentId);
  if (!settings?.enabled || settings.provider === "auto") return undefined;

  const adapter = getMemoryEmbeddingProvider(settings.provider, cfg);
  if (!adapter) return undefined;

  const model = settings.model.trim() || adapter.defaultModel || "";
  let created: Promise<Embedder> | undefined;

  return () =>
    (created ??= adapter
      .create({
        config: cfg,
        agentDir,
        provider: settings.provider,
        model,
        remote: settings.remote,
        fallback: "none",
        ...(settings.outputDimensionality !== undefined ? { dimensions: settings.outputDimensionality } : {}),
      })
      .then(({ provider }) => {
        if (!provider) throw new Error(`embedding provider ${settings.provider} is unavailable`);
        return {
          identity: `${provider.id}/${provider.model}`,
          documents: async (texts) =>
            (await provider.embedBatch([...texts], { inputType: "document" })).map((v) => Float32Array.from(v)),
          query: async (text) => Float32Array.from(await provider.embed(text, { inputType: "query" })),
        };
      }));
};
