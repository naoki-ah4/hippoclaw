import type { OpenClawPluginDefinition, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "openclaw/plugin-sdk/agent-runtime";
import { createCapability } from "./capability.ts";
import { resolveConfig } from "./config.ts";
import { createStore } from "./store.ts";
import { memoryAppendTool, memoryGetTool, memorySearchTool } from "./tools.ts";
import { appendMemory } from "./append.ts";

// name と description はマニフェストの物を使う
const entry: OpenClawPluginDefinition = {
  id: "hippoclaw-memory",
  register(api) {
    const config = resolveConfig(api.pluginConfig);
    api.registerMemoryCapability(createCapability(config));

    // ツールは呼ばれた agent の workspace を見る。分からなければ出さない
    const storeFor = (ctx: OpenClawPluginToolContext) => {
      const cfg = ctx.getRuntimeConfig?.() ?? ctx.runtimeConfig ?? ctx.config ?? api.config;
      const rootDir = ctx.workspaceDir ?? (ctx.agentId ? resolveAgentWorkspaceDir(cfg, ctx.agentId) : undefined);

      return rootDir ? createStore(rootDir, config) : null;
    };

    api.registerTool(
      (ctx) => {
        const store = storeFor(ctx);
        return store ? memorySearchTool(store, config) : null;
      },
      { names: ["memory_search"] },
    );
    api.registerTool(
      (ctx) => {
        const store = storeFor(ctx);
        return store ? memoryGetTool(store) : null;
      },
      { names: ["memory_get"] },
    );
    api.registerTool(
      (ctx) => {
        const store = storeFor(ctx);
        return store ? memoryAppendTool(store) : null;
      },
      { names: ["memory_append"], optional: true },
    );

    // 人が直接書く口。モデルを通さない
    api.registerCommand({
      name: "remember",
      description: "Append a line to today's memory file",
      acceptsArgs: true,
      async handler(ctx) {
        const text = ctx.args?.trim();
        if (!text) return { text: "Usage: /remember <text>" };

        const rootDir = resolveAgentWorkspaceDir(ctx.config, ctx.agentId ?? resolveDefaultAgentId(ctx.config));
        const { path, line } = await appendMemory(rootDir, text);

        return { text: `${path}: ${line}` };
      },
    });

    api.logger.info(`hippoclaw-memory: registered (include=${config.include.join(", ")})`);
  },
};

export default entry;
