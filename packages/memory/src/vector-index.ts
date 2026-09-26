// 記憶ファイルの行の索引。表の形は db/schema.ts
import { mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Kysely, sql } from "kysely";
import { loadSqliteVecExtension } from "openclaw/plugin-sdk/memory-core-host-engine-knn";
import { nodeSqliteDialect } from "./db/node-sqlite-dialect.ts";
import { createIndexTables, createVectorsTable, dropIndexTables, ensureMetaTable, SCHEMA_VERSION, type IndexDatabase } from "./db/schema.ts";
import type { Embedder } from "./embed.ts";
import type { SearchHit } from "./types/search.ts";

export type IndexSource = {
  readonly rootDir: string;
  list(): Promise<string[]>;
  text(relPath: string): Promise<string | null>;
};

/** 意味の近さと語の一致の重み。足して 1 */
const SEMANTIC_WEIGHT = 0.7;
const LEXICAL_WEIGHT = 0.3;
/** 意味の近さで先に拾う候補の数 */
const KNN_CANDIDATES = 50;
/** 古い日付ファイルの行から引く点の上限と、その半分に届くまでの日数。MEMORY.md のように日付の無い行は引かない */
const AGE_PENALTY_MAX = 0.1;
const AGE_PENALTY_HALF_LIFE_DAYS = 30;
/**
 * これより近い行は同じ事実の書き直しとみなし、点の高い一つだけを返す（コサイン距離）。
 * bge-m3 で測ると、句点や日付の書き方だけの違いは 0.04 未満、姉と妹のような一語違いの別の事実は 0.05 前後。
 * 言い換え（0.1 前後）までまとめようとすると別の事実も巻き込むので、表面の違いだけをまとめる
 */
const DUPLICATE_DISTANCE = 0.04;
/** まとめる前に取る候補の数。多く取っておかないと、まとめた後に件数が足りなくなる */
const CANDIDATE_FACTOR = 4;

/** memory/YYYY-MM-DD.md の日付。それ以外のファイルは日付を持たない */
const recordedOn = (relPath: string): string | null => /(\d{4}-\d{2}-\d{2})\.md$/.exec(relPath)?.[1] ?? null;

const blob = (v: Float32Array): Uint8Array => new Uint8Array(v.buffer, v.byteOffset, v.byteLength);

export class VectorIndex {
  private readonly db: Kysely<IndexDatabase>;

  private constructor(db: Kysely<IndexDatabase>) {
    this.db = db;
  }

  /** agent の state ディレクトリの下に開く。sqlite-vec は OpenClaw が同梱している物を読む */
  static async open(stateDir: string): Promise<VectorIndex> {
    const dir = path.join(stateDir, "hippoclaw-memory");
    mkdirSync(dir, { recursive: true });

    const raw = new DatabaseSync(path.join(dir, "index.sqlite"), { allowExtension: true });
    const loaded = await loadSqliteVecExtension({ db: raw });
    if (!loaded.ok) throw new Error(loaded.error);

    const db = new Kysely<IndexDatabase>({ dialect: nodeSqliteDialect(raw) });
    const index = new VectorIndex(db);

    await ensureMetaTable(db);
    if ((await index.meta("schema")) !== SCHEMA_VERSION) {
      await dropIndexTables(db);
      await db.deleteFrom("meta").execute();
      await createIndexTables(db);
      await index.setMeta("schema", SCHEMA_VERSION);
    }

    return index;
  }

  async close(): Promise<void> {
    await this.db.destroy();
  }

  /** 変わったファイルだけ行を入れ直し、どこからも指されない本文を消し、まだ埋め込みの無い本文を埋め込む */
  async sync(source: IndexSource, embedder: Embedder): Promise<void> {
    const listed = await source.list();

    const known = await this.db.selectFrom("files").selectAll().execute();
    for (const file of known) {
      if (!listed.includes(file.path)) await this.removeFile(file.path);
    }

    for (const relPath of listed) {
      const info = await stat(path.join(source.rootDir, relPath)).catch(() => null);
      if (!info) continue;

      const mtimeMs = Math.trunc(info.mtimeMs);
      const same = known.find((f) => f.path === relPath && f.mtime_ms === mtimeMs && f.size === info.size);
      if (same) continue;

      const text = await source.text(relPath);
      if (text !== null) await this.replaceFile(relPath, text, mtimeMs, info.size);
    }

    await this.removeOrphans();
    await this.embedPending(embedder);
  }

  /** today は YYYY-MM-DD。古い日付ファイルの行を減点する基準 */
  async search(vector: Float32Array, terms: readonly string[], limit: number, today: string): Promise<SearchHit[]> {
    if ((await this.meta("dim")) === undefined) return [];

    const { rows } = await sql<{ path: string; line: number; text: string; score: number }>`
      WITH
        -- vec0 の KNN は外の ORDER BY と混ざると弾かれるので、先に確定させる
        knn AS MATERIALIZED (
          SELECT rowid AS text_id, distance FROM vectors
          WHERE embedding MATCH ${blob(vector)} AND k = ${KNN_CANDIDATES}
          ORDER BY distance
        ),

        terms AS (SELECT value AS term FROM json_each(${JSON.stringify(terms)})),

        lex AS (
          SELECT t.id AS text_id, CAST(COUNT(*) AS REAL) / ${Math.max(1, terms.length)} AS lexical
          FROM texts t JOIN terms ON instr(lower(t.text), terms.term) > 0
          GROUP BY t.id
        ),

        candidates AS (SELECT text_id FROM knn UNION SELECT text_id FROM lex),

        scored AS (
          SELECT
            c.text_id,
            ${SEMANTIC_WEIGHT} * max(0.0, 1.0 - coalesce(knn.distance, 1.0))
              + ${LEXICAL_WEIGHT} * coalesce(lex.lexical, 0.0) AS relevance
          FROM candidates c
          LEFT JOIN knn ON knn.text_id = c.text_id
          LEFT JOIN lex ON lex.text_id = c.text_id
        ),

        -- 古い日付ファイルの行を減点する。日付の無い行（MEMORY.md）は引かない
        aged AS (
          SELECT
            l.path, l.line, s.text_id, s.relevance,
            CASE
              WHEN l.recorded_on IS NULL THEN 0.0
              ELSE ${AGE_PENALTY_MAX} * (1.0 - pow(0.5, max(0.0, julianday(${today}) - julianday(l.recorded_on)) / ${AGE_PENALTY_HALF_LIFE_DAYS}))
            END AS penalty
          FROM scored s
          JOIN lines l ON l.text_id = s.text_id
          WHERE s.relevance > 0
        ),

        ranked AS (
          SELECT a.path, a.line, a.text_id, max(0.0, a.relevance - a.penalty) AS score
          FROM aged a
          ORDER BY score DESC, a.path, a.line
          LIMIT ${limit * CANDIDATE_FACTOR}
        ),

        -- 自分より上に、ほぼ同じ行（同じ本文も含む）があれば落とす
        distinct_facts AS (
          SELECT r.* FROM ranked r
          WHERE NOT EXISTS (
            SELECT 1 FROM ranked h
            JOIN vectors hv ON hv.rowid = h.text_id
            JOIN vectors rv ON rv.rowid = r.text_id
            WHERE (h.score > r.score OR (h.score = r.score AND (h.path < r.path OR (h.path = r.path AND h.line < r.line))))
              AND (h.text_id = r.text_id OR vec_distance_cosine(hv.embedding, rv.embedding) < ${DUPLICATE_DISTANCE})
          )
        )
      
      SELECT d.path AS path, d.line AS line, t.text AS text, d.score AS score
      FROM distinct_facts d
      JOIN texts t ON t.id = d.text_id
      ORDER BY d.score DESC, d.path, d.line
      LIMIT ${limit}
    `.execute(this.db);

    return rows.map((r) => ({ path: r.path, startLine: r.line, endLine: r.line, score: r.score, text: r.text }));
  }

  private async meta(key: string): Promise<string | undefined> {
    const row = await this.db.selectFrom("meta").select("value").where("key", "=", key).executeTakeFirst();
    return row?.value;
  }

  private async setMeta(key: string, value: string): Promise<void> {
    await this.db
      .insertInto("meta")
      .values({ key, value })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value }))
      .execute();
  }

  private async removeFile(relPath: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("lines").where("path", "=", relPath).execute();
      await trx.deleteFrom("files").where("path", "=", relPath).execute();
    });
  }

  /**
   * どの行からも指されていない本文と、その埋め込みを消す。行を直すと前の本文が残り、
   * 残った埋め込みが意味検索の候補の枠を食うので、索引を合わせるたびに消す
   */
  private async removeOrphans(): Promise<void> {
    const hasVectors = (await this.meta("dim")) !== undefined;

    await this.db.transaction().execute(async (trx) => {
      const orphans = trx.selectFrom("texts").select("id").where("id", "not in", trx.selectFrom("lines").select("text_id"));
      if (hasVectors) await sql`DELETE FROM vectors WHERE rowid IN (${orphans})`.execute(trx);
      await trx.deleteFrom("texts").where("id", "in", orphans).execute();
    });
  }

  private async replaceFile(relPath: string, text: string, mtimeMs: number, size: number): Promise<void> {
    const date = recordedOn(relPath);

    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("lines").where("path", "=", relPath).execute();

      for (const [i, raw] of text.split(/\r?\n/).entries()) {
        const line = raw.trim();
        if (line === "") continue;

        await trx.insertInto("texts").values({ text: line }).onConflict((oc) => oc.column("text").doNothing()).execute();
        const { id } = await trx.selectFrom("texts").select("id").where("text", "=", line).executeTakeFirstOrThrow();
        await trx.insertInto("lines").values({ path: relPath, line: i + 1, text_id: id, recorded_on: date }).execute();
      }

      await trx
        .insertInto("files")
        .values({ path: relPath, mtime_ms: mtimeMs, size })
        .onConflict((oc) => oc.column("path").doUpdateSet({ mtime_ms: mtimeMs, size }))
        .execute();
    });
  }

  /** 埋め込みの無い本文を埋め込む。モデルか次元が変わっていたら埋め込みを全部作り直す */
  private async embedPending(embedder: Embedder): Promise<void> {
    if ((await this.meta("model")) !== embedder.identity) {
      await sql`DROP TABLE IF EXISTS vectors`.execute(this.db);
      await this.db.updateTable("texts").set({ embedded: 0 }).execute();
      await this.db.deleteFrom("meta").where("key", "=", "dim").execute();
      await this.setMeta("model", embedder.identity);
    }

    const pending = await this.db.selectFrom("texts").select(["id", "text"]).where("embedded", "=", 0).execute();
    if (pending.length === 0) return;

    const vectors = await embedder.documents(pending.map((p) => p.text));
    const dim = vectors[0]?.length;
    if (!dim) return;
    if ((await this.meta("dim")) === undefined) {
      await createVectorsTable(dim).execute(this.db);
      await this.setMeta("dim", String(dim));
    }

    await this.db.transaction().execute(async (trx) => {
      for (const [i, p] of pending.entries()) {
        const v = vectors[i];
        if (!v) continue;
        // vec0 の rowid は整数で渡さないと弾かれる
        await sql`INSERT INTO vectors (rowid, embedding) VALUES (${BigInt(p.id)}, ${blob(v)})`.execute(trx);
        await trx.updateTable("texts").set({ embedded: 1 }).where("id", "=", p.id).execute();
      }
    });
  }
}
