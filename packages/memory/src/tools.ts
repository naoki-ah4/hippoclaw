// モデルに見せるツール。memory_search と memory_get
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/core";
import { readPositiveIntegerParam } from "openclaw/plugin-sdk/agent-runtime";
import type { AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import { appendMemory } from "./append.ts";
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

/** 任意ツール。tools.allow で明示した時だけモデルに見える */
export const memoryAppendTool = (store: MemoryStore): AnyAgentTool => ({
  label: "Memory Append",
  name: "memory_append",
  // 今日の記憶ファイルに 1 行足す。ユーザーが覚えておいてほしいと言った事実だけ。要約や推測は書かない
  description:
    "Append one line to today's memory file. Use only for a fact the user asked you to remember. Do not write summaries or guesses.",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "The fact to remember, in one line" },
    },
    required: ["text"],
    additionalProperties: false,
  },
  async execute(_toolCallId, raw) {
    const text = readStringParam(raw as Params, "text", { required: true });

    return jsonResult(await appendMemory(store.files.rootDir, text));
  },
});
