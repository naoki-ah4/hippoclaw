// openclaw/plugin-sdk/memory-core-host-engine-embeddings は d.ts が付いていない入口。
// 実装と memory-core の使い方（extensions/memory-core/src/memory/embeddings.ts）から読み取った形。版を上げたらここと embed.ts だけを疑う
declare module "openclaw/plugin-sdk/memory-core-host-engine-embeddings" {
  import type { OpenClawConfig } from "openclaw/plugin-sdk/plugin-entry";

  export type EmbeddingInputType = "query" | "document";

  export type MemoryEmbeddingProvider = {
    id: string;
    model: string;
    embed(input: string, options?: { inputType?: EmbeddingInputType; signal?: AbortSignal }): Promise<number[]>;
    embedBatch(inputs: string[], options?: { inputType?: EmbeddingInputType; signal?: AbortSignal }): Promise<number[][]>;
  };

  export type MemoryEmbeddingProviderAdapter = {
    id: string;
    defaultModel?: string;
    create(options: {
      config: OpenClawConfig;
      agentDir: string;
      provider: string;
      model: string;
      remote?: unknown;
      fallback: string;
      dimensions?: number;
    }): Promise<{ provider: MemoryEmbeddingProvider | null }>;
  };

  export function getMemoryEmbeddingProvider(id: string, config?: OpenClawConfig): MemoryEmbeddingProviderAdapter | undefined;
}
