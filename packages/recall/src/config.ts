// プラグイン設定。マニフェストの configSchema と同じ既定値を持つ
import * as v from "valibot";

export const recallConfigSchema = v.pipe(
  v.object({
    maxResults: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)), 3),
    maxChars: v.optional(v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(8000)), 1200),
  }),
  v.readonly(),
);

export type RecallConfig = v.InferOutput<typeof recallConfigSchema>;

export const resolveConfig = (raw: unknown): RecallConfig => v.parse(recallConfigSchema, raw ?? {});
