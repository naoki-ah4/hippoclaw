// プラグイン設定。マニフェストの configSchema と同じ既定値を持つ
import * as v from "valibot";

export const journalConfigSchema = v.pipe(
  v.object({
    minChars: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1500),
    idleMinutes: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 15),
    maxInputChars: v.optional(v.pipe(v.number(), v.integer(), v.minValue(200)), 4000),
    assistantHead: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
    maxAgeDays: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(365)), 30),
    model: v.optional(v.pipe(v.string(), v.trim(), v.nonEmpty())),
  }),
  v.readonly(),
);

export type JournalConfig = v.InferOutput<typeof journalConfigSchema>;

export const resolveConfig = (raw: unknown): JournalConfig => v.parse(journalConfigSchema, raw ?? {});
