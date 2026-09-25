import type { OpenClawConfig, OpenClawPluginDefinition } from "openclaw/plugin-sdk/plugin-entry";
import { getMemoryCapabilityRegistration } from "openclaw/plugin-sdk/memory-host-core";
import { buildBlock } from "./block.ts";
import { resolveConfig } from "./config.ts";

// name と description はマニフェストの物を使う
const entry: OpenClawPluginDefinition = {
  id: "hippoclaw-recall",
  register(api) {
    const config = resolveConfig(api.pluginConfig);

    // 毎ターン、着信した発言そのものを検索語にして slot の検索を引き、当たった分を発言の前に置く
    api.on("before_prompt_build", async (event, ctx) => {
      if (ctx.trigger !== "user" || !ctx.agentId) return undefined;

      const runtime = getMemoryCapabilityRegistration()?.capability.runtime;
      if (!runtime) return undefined;

      // api.config は readonly 型なので、runtime が無い時だけ落とす
      const cfg = (api.runtime.config?.current?.() ?? api.config) as OpenClawConfig;
      const { manager } = await runtime.getMemorySearchManager({ cfg, agentId: ctx.agentId });
      if (!manager) return undefined;

      const hits = await manager.search(event.prompt, { maxResults: config.maxResults, lexicalOnly: true });
      const block = buildBlock(hits, config.maxChars);
      if (!block) return undefined;

      api.logger.info(`hippoclaw-recall: injected ${hits.length} hit(s)`);
      return { prependContext: block };
    });

    api.logger.info(`hippoclaw-recall: registered (maxResults=${config.maxResults}, maxChars=${config.maxChars})`);
  },
};

export default entry;
