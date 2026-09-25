import type { OpenClawPluginDefinition } from "openclaw/plugin-sdk/plugin-entry";
import { createCapability } from "./capability.ts";
import { resolveConfig } from "./config.ts";

// name と description はマニフェストの物を使う
const entry: OpenClawPluginDefinition = {
  id: "hippoclaw-memory",
  register(api) {
    const config = resolveConfig(api.pluginConfig);
    api.registerMemoryCapability(createCapability(config));
    api.logger.info(`hippoclaw-memory: registered (include=${config.include.join(", ")})`);
  },
};

export default entry;
