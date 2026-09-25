import { definePluginEntry, type OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "hippoclaw-memory",
  name: "hippoclaw-memory",
  description: "memory-core 相当。plugins.slots.memory を取り、許可リストで索引を作る",
  register(api: OpenClawPluginApi) {
    api.registerMemoryCapability({
      promptBuilder: () => [],
      // 圧縮前 flush には乗らない
      flushPlanResolver: () => null,
    });
    api.logger.info("hippoclaw-memory: registered");
  },
});
