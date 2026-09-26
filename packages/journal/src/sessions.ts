import type { OpenClawConfig } from "openclaw/plugin-sdk/plugin-entry";
import { resolveAgentDir, resolveAgentWorkspaceDir } from "openclaw/plugin-sdk/agent-runtime";
import type { JournalConfig } from "./config.ts";
import { contextWindowOf, hardMaxCharsOf } from "./context.ts";
import type { DrainTarget } from "./drain.ts";
import { Marks } from "./marks.ts";

export type Session = DrainTarget & { key: string; marks: Marks; lastUserAt: number };

export type SessionContext = {
  agentId?: string;
  sessionId?: string;
  workspaceDir?: string;
  contextTokenBudget?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** フックで見かけた session を覚えておき、静かになった物を取り出す */
export class SessionRegistry {
  private readonly config: JournalConfig;
  private readonly sessions = new Map<string, Session>();
  private readonly marksByAgent = new Map<string, Marks>();

  constructor(config: JournalConfig) {
    this.config = config;
  }

  remember(cfg: OpenClawConfig, ctx: SessionContext): Session | null {
    if (!ctx.agentId || !ctx.sessionId) return null;

    const contextTokens = ctx.contextTokenBudget ?? contextWindowOf(cfg, ctx.agentId, this.config.model);
    const session: Session = {
      key: `${ctx.agentId}/${ctx.sessionId}`,
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      rootDir: ctx.workspaceDir ?? resolveAgentWorkspaceDir(cfg, ctx.agentId),
      hardMaxChars: hardMaxCharsOf(contextTokens, this.config.maxInputChars),
      marks: this.marksFor(cfg, ctx.agentId),
      lastUserAt: Date.now(),
    };
    this.sessions.set(session.key, session);

    return session;
  }

  /** idleMinutes 以上話していない session を取り出して、台帳から外す */
  takeIdle(now = Date.now()): Session[] {
    const idle = [...this.sessions.values()].filter((s) => now - s.lastUserAt >= this.config.idleMinutes * 60_000);
    for (const s of idle) this.sessions.delete(s.key);

    return idle;
  }

  close(): void {
    for (const marks of this.marksByAgent.values()) marks.close();
    this.marksByAgent.clear();
  }

  private marksFor(cfg: OpenClawConfig, agentId: string): Marks {
    let marks = this.marksByAgent.get(agentId);
    if (!marks) {
      marks = new Marks(resolveAgentDir(cfg, agentId), { maxAgeMs: this.config.maxAgeDays * DAY_MS });
      this.marksByAgent.set(agentId, marks);
    }
    return marks;
  }
}
