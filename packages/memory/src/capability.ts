// OpenClaw の memory slot に見せる面。検索と読み出しをホストの契約に写す
import type { MemoryPluginCapability } from "openclaw/plugin-sdk/memory-host-core";
import { resolveAgentWorkspaceDir } from "openclaw/plugin-sdk/agent-runtime";
import type { MemoryConfig } from "./config.ts";
import { createStore } from "./store.ts";

type MemoryRuntime = NonNullable<MemoryPluginCapability["runtime"]>;
/** ホストが getMemorySearchManager から受け取る manager の型。SDK が export していないので辿る */
type SearchManager = NonNullable<Awaited<ReturnType<MemoryRuntime["getMemorySearchManager"]>>["manager"]>;

const createSearchManager = (rootDir: string, config: MemoryConfig): SearchManager => {
  const { files, search } = createStore(rootDir, config);

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

/** システムプロンプトの Memory 節。ツールが出ている時だけ */
const promptSection = (availableTools: Set<string>): string[] => {
  const hasSearch = availableTools.has("memory_search");
  const hasGet = availableTools.has("memory_get");
  if (!hasSearch && !hasGet) return [];

  // 人・好み・決めたこと・日付・予定について答える前に memory_search を呼ぶ。必要な行だけ memory_get で読む。
  // 見つからなければ、探したが無かったと言う
  return [
    "## Memory Recall",
    hasSearch
      ? "Before answering about people, preferences, decisions, dates, or plans, call memory_search." + (hasGet ? " Read only the lines you need with memory_get." : "")
      : "Read only the lines you need from memory files with memory_get.",
    "If nothing is found, say that you searched and found nothing.",
    "",
  ];
};

export const createCapability = (config: MemoryConfig): MemoryPluginCapability => ({
  // active-memory はこの名前のツールを決定的に呼ぶ
  deterministicRecallToolName: "memory_search",
  supportsPrivateTranscriptRecall: false,
  promptBuilder: ({ availableTools }) => promptSection(availableTools),
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
