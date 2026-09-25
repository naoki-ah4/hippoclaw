import type { OpenClawPluginDefinition, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { resolveAgentWorkspaceDir } from "openclaw/plugin-sdk/agent-runtime";
import { createCapability } from "./capability.ts";
import { resolveConfig } from "./config.ts";
import { createStore } from "./store.ts";
import { memoryGetTool, memorySearchTool } from "./tools.ts";

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

    api.logger.info(`hippoclaw-memory: registered (include=${config.include.join(", ")})`);
  },
};

export default entry;
