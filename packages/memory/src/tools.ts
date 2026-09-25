// モデルに見せるツール。memory_search と memory_get
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/core";
import { readPositiveIntegerParam } from "openclaw/plugin-sdk/agent-runtime";
import type { AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import type { MemoryConfig } from "./config.ts";
import type { MemoryStore } from "./store.ts";

// execute の引数は parameters の schema で検証済み。型だけ unknown で来る
type Params = Record<string, unknown>;

export const memorySearchTool = (store: MemoryStore, config: MemoryConfig): AnyAgentTool => ({
  label: "Memory Search",
  name: "memory_search",
  // 記憶ファイルを探す。人・好み・決めたこと・日付・予定について答える前に呼ぶ。結果の path と行番号を memory_get に渡すと続きを読める
  description:
    "Search the user's memory files. Call this before answering about people, preferences, decisions, dates, or plans. Pass a result's path and line numbers to memory_get to read more.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "What to look for, in natural language" },
      maxResults: { type: "integer", minimum: 1, maximum: 50 },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(_toolCallId, raw) {
    const params = raw as Params;
    const query = readStringParam(params, "query", { required: true });
    const maxResults = readPositiveIntegerParam(params, "maxResults") ?? config.maxResults;
    const results = await store.search.search(query, { maxResults });

    return jsonResult({ query, results });
  },
});

export const memoryGetTool = (store: MemoryStore): AnyAgentTool => ({
  label: "Memory Get",
  name: "memory_get",
  // 記憶ファイルの行を読む。path は memory_search が返した物だけ
  description: "Read lines from a memory file. Use only a path returned by memory_search.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "A path returned by memory_search" },
      from: { type: "integer", minimum: 1, description: "First line to read, starting at 1" },
      lines: { type: "integer", minimum: 1, maximum: 400 },
    },
    required: ["path"],
    additionalProperties: false,
  },
  async execute(_toolCallId, raw) {
    const params = raw as Params;
    const relPath = readStringParam(params, "path", { required: true });
    const from = readPositiveIntegerParam(params, "from");
    const lines = readPositiveIntegerParam(params, "lines");

    return jsonResult(await store.files.read(relPath, { from, lines }));
  },
});
