// openclaw/plugin-sdk/memory-core-host-engine-knn は d.ts が付いていない入口。実装（dist/sqlite-vec-*.mjs）から読み取った形。
// 版を上げたらここと vector-index.ts だけを疑う
declare module "openclaw/plugin-sdk/memory-core-host-engine-knn" {
  import type { DatabaseSync } from "node:sqlite";

  export function loadSqliteVecExtension(params: {
    db: DatabaseSync;
    extensionPath?: string;
  }): Promise<{ ok: true; extensionPath: string } | { ok: false; error: string }>;
}
