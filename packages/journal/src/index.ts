import type { OpenClawConfig, OpenClawPluginDefinition } from "openclaw/plugin-sdk/plugin-entry";
import { resolveConfig } from "./config.ts";
import { drain } from "./drain.ts";
import { SessionRegistry, type Session, type SessionContext } from "./sessions.ts";

// name と description はマニフェストの物を使う
const entry: OpenClawPluginDefinition = {
  id: "hippoclaw-journal",
  register(api) {
    const config = resolveConfig(api.pluginConfig);
    const log = (message: string) => api.logger.info(`hippoclaw-journal: ${message}`);
    const registry = new SessionRegistry(config);
    const running = new Set<string>();

    const remember = (ctx: SessionContext) =>
      registry.remember((api.runtime.config?.current?.() ?? api.config) as OpenClawConfig, ctx);

    // 同じ session を同時に二本走らせない。失敗は警告にして次のトリガーに任せる
    const run = async (session: Session, minUserChars: number): Promise<void> => {
      if (running.has(session.key)) return;
      running.add(session.key);

      try {
        await drain(session, minUserChars, config, { marks: session.marks, llm: api.runtime.llm, log });
      } catch (error) {
        api.logger.warn(`hippoclaw-journal: ${session.key}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        running.delete(session.key);
      }
    };

    api.on("agent_end", async (_event, ctx) => {
      if (ctx.trigger !== "user") return;
      const session = remember(ctx);
      if (session) await run(session, config.minChars);
    });

    // /new の前に、量に関係なく残りを片付ける
    api.on("before_reset", async (_event, ctx) => {
      const session = remember(ctx);
      if (session) await run(session, 1);
    });

    // 静かになった session を 1 分ごとに見る。timer の始める・止める・作り直すは gateway に持たせる
    let timer: NodeJS.Timeout | undefined;
    api.registerService({
      id: "hippoclaw-journal-idle",
      reload: { configPrefixes: ["plugins.entries.hippoclaw-journal"] },
      start() {
        log(`idle sweep started (idle after ${config.idleMinutes} min)`);
        timer = setInterval(() => {
          for (const session of registry.takeIdle()) void run(session, 1);
        }, 60_000);
        timer.unref();
      },
      stop() {
        log("idle sweep stopped");
        clearInterval(timer);
        timer = undefined;
        registry.close();
      },
    });

    log(`registered (minChars=${config.minChars}, idleMinutes=${config.idleMinutes})`);
  },
};

export default entry;
