// OpenClaw の memory slot に見せる面。検索と読み出しをホストの契約に写す
import type { MemoryPluginCapability } from "openclaw/plugin-sdk/memory-host-core";
import { resolveAgentWorkspaceDir } from "openclaw/plugin-sdk/agent-runtime";
import type { MemoryConfig } from "./config.ts";
import { MemoryFiles } from "./files.ts";
import { WordMatchSearch } from "./search-words.ts";

type MemoryRuntime = NonNullable<MemoryPluginCapability["runtime"]>;
/** ホストが getMemorySearchManager から受け取る manager の型。SDK が export していないので辿る */
type SearchManager = NonNullable<Awaited<ReturnType<MemoryRuntime["getMemorySearchManager"]>>["manager"]>;

const createSearchManager = (rootDir: string, config: MemoryConfig): SearchManager => {
  const files = new MemoryFiles({ rootDir, include: config.include, exclude: config.exclude });
  const search = new WordMatchSearch(files);

  return {
    async search(query, opts) {
      const hits = await search.search(query, { maxResults: opts?.maxResults ?? config.maxResults });

      return hits.map(({ text, ...hit }) => ({ ...hit, snippet: text, source: "memory" as const }));
    },

    async readFile({ relPath, from, lines }) {
      const result = await files.read(relPath, { from, lines });
      if (result.status !== "ok") return { status: "not_found", text: "", path: result.path };

      const { nextFrom, ...rest } = result;
      return nextFrom === undefined ? rest : { ...rest, nextFrom, truncated: true };
    },

    status() {
      return { backend: "builtin", provider: "hippoclaw-memory", workspaceDir: rootDir };
    },

    // embedding も vector も持たない
    async probeEmbeddingAvailability() {
      return { ok: false, checked: true };
    },
    async probeVectorAvailability() {
      return false;
    },
  };
};

export const createCapability = (config: MemoryConfig): MemoryPluginCapability => ({
  promptBuilder: () => [],
  // 圧縮前 flush には乗らない
  flushPlanResolver: () => null,
  runtime: {
    async getMemorySearchManager({ cfg, agentId }) {
      return { manager: createSearchManager(resolveAgentWorkspaceDir(cfg, agentId), config) };
    },
    resolveMemoryBackendConfig() {
      return { backend: "builtin" };
    },
  },
});
