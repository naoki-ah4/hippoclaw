import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { OpenClawConfig } from "openclaw/plugin-sdk/plugin-entry";
import { resolveConfig } from "../src/config.ts";
import { SessionRegistry } from "../src/sessions.ts";

const setup = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "hippoclaw-sessions-"));
  const cfg = { agents: { defaults: { workspace: dir }, list: [{ id: "main", agentDir: dir }] } } as unknown as OpenClawConfig;
  const registry = new SessionRegistry(resolveConfig({ idleMinutes: 15 }));
  return { dir, cfg, registry };
};

test("agentId か sessionId が無ければ覚えない", async () => {
  const { cfg, registry } = await setup();
  assert.equal(registry.remember(cfg, { agentId: "main" }), null);
  assert.equal(registry.remember(cfg, { sessionId: "s1" }), null);
  registry.close();
});

test("静かになった session だけを一度だけ取り出す", async () => {
  const { dir, cfg, registry } = await setup();
  const quiet = registry.remember(cfg, { agentId: "main", sessionId: "quiet", workspaceDir: dir, contextTokenBudget: 1000 });
  registry.remember(cfg, { agentId: "main", sessionId: "busy", workspaceDir: dir, contextTokenBudget: 1000 });
  assert.ok(quiet);
  quiet.lastUserAt -= 16 * 60_000;

  assert.deepEqual(registry.takeIdle().map((s) => s.sessionId), ["quiet"]);
  assert.deepEqual(registry.takeIdle(), []);
  assert.equal(quiet.hardMaxChars, 500);
  registry.close();
});
