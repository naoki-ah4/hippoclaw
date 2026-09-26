// 要約に使うモデルの context の大きさ（トークン）。設定のカタログから引く
import type { OpenClawConfig } from "openclaw/plugin-sdk/plugin-entry";
import { buildConfiguredModelCatalog, findModelInCatalog, resolveDefaultModelForAgent } from "openclaw/plugin-sdk/agent-runtime";

/** "provider/model"。model の側に "/" が入ることがあるので、最初の "/" で割る */
const splitRef = (ref: string): { provider: string; model: string } | undefined => {
  const i = ref.indexOf("/");
  return i > 0 && i < ref.length - 1 ? { provider: ref.slice(0, i), model: ref.slice(i + 1) } : undefined;
};

export const contextWindowOf = (cfg: OpenClawConfig, agentId: string, modelOverride?: string): number | undefined => {
  const ref = modelOverride !== undefined ? splitRef(modelOverride) : resolveDefaultModelForAgent({ cfg, agentId });
  if (!ref) return undefined;

  const entry = findModelInCatalog(buildConfiguredModelCatalog({ cfg }), ref.provider, ref.model);
  return entry?.contextWindow;
};

/**
 * どのバッチも超えない文字数。context（トークン）を 1 字 1 トークンと見て、その半分。
 * 残り半分は指示文と出力と、日本語で 1 字が 2 トークンになる分の余裕。分からなければ目安と同じ
 */
export const hardMaxCharsOf = (contextTokens: number | undefined, maxInputChars: number): number =>
  contextTokens === undefined ? maxInputChars : Math.max(1, Math.floor(contextTokens / 2));
