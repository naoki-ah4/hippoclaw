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

export type EmbedderSource = {
  /** 埋め込みを決める設定の組。これが同じなら同じ埋め込みになる */
  key: string;
  /** 埋め込みの provider を作る。一度作れたら使い回し、失敗は覚えずに次の呼び出しでやり直す */
  open: () => Promise<Embedder>;
};

/**
 * memory.search に provider が書かれていれば、その埋め込みの作り方を返す。無ければ undefined（語の一致だけで探す）。
 * provider の既定の "auto" は選ばない。memory-core はそこで OpenAI の鍵を探しに行くので、明示された時だけ使う
 */
export const embedderFor = (cfg: OpenClawConfig, agentId: string, agentDir: string): EmbedderSource | undefined => {
  const settings = resolveMemorySearchConfig(cfg, agentId);
  if (!settings?.enabled || settings.provider === "auto") return undefined;

  const adapter = getMemoryEmbeddingProvider(settings.provider, cfg);
  if (!adapter) return undefined;

  const model = settings.model.trim() || adapter.defaultModel || "";
  const key = JSON.stringify([settings.provider, model, settings.remote?.baseUrl ?? null, settings.outputDimensionality ?? null]);

  let created: Promise<Embedder> | undefined;
  const create = async (): Promise<Embedder> => {
    const { provider } = await adapter.create({
      config: cfg,
      agentDir,
      provider: settings.provider,
      model,
      remote: settings.remote,
      fallback: "none",
      ...(settings.outputDimensionality !== undefined ? { dimensions: settings.outputDimensionality } : {}),
    });
    if (!provider) throw new Error(`embedding provider ${settings.provider} is unavailable`);

    return {
      identity: `${provider.id}/${provider.model}`,
      documents: async (texts) => (await provider.embedBatch([...texts], { inputType: "document" })).map((v) => Float32Array.from(v)),
      query: async (text) => Float32Array.from(await provider.embed(text, { inputType: "query" })),
    };
  };

  const open = () =>
    (created ??= create().catch((error: unknown) => {
      created = undefined;
      throw error;
    }));

  return { key, open };
};
