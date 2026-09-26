// openclaw/plugin-sdk/session-transcript-runtime は d.ts が付いていない入口。実装（dist/session-transcript-runtime-*.mjs）から読み取った形。
// 版を上げたらここと transcript.ts だけを疑う
declare module "openclaw/plugin-sdk/session-transcript-runtime" {
  export type VisibleMessageDeltaParams = {
    agentId: string;
    sessionId: string;
    sessionKey?: string;
    cursor?: string;
    maxMessages?: number;
    maxBytes?: number;
  };

  export type VisibleMessageEntry = {
    entryId: string;
    seq: number;
    role: string;
    message: unknown;
    createdAt?: string;
  };

  export type VisibleMessageDeltaResult =
    | { kind: "page"; cursor: string; entries: VisibleMessageEntry[]; hasMore: boolean }
    | { kind: "reset"; cursor: string; reason: string }
    | { kind: "missing" }
    | { kind: "unavailable"; reason: string };

  export function readSessionTranscriptVisibleMessageDelta(
    params: VisibleMessageDeltaParams,
  ): Promise<VisibleMessageDeltaResult>;
}
