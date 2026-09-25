// プラグイン設定。マニフェストの configSchema と同じ既定値を持つ
import * as v from "valibot";

const glob = v.pipe(v.string(), v.trim(), v.nonEmpty());
const globList = v.pipe(v.array(glob), v.readonly());

export const memoryConfigSchema = v.pipe(
  v.object({
    include: v.optional(globList, ["MEMORY.md", "memory/*.md"]),
    exclude: v.optional(globList, []),
    maxResults: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50)), 6),
  }),
  v.readonly(),
);

export type MemoryConfig = v.InferOutput<typeof memoryConfigSchema>;

export const resolveConfig = (raw: unknown): MemoryConfig => v.parse(memoryConfigSchema, raw ?? {});
