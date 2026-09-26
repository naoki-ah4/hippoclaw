// 記憶の索引の表。本体は Markdown で、ここはいつでも作り直せる写し
import { sql, type Generated, type Kysely } from "kysely";

/** 表の形を変えたら上げる。合わなければ索引を作り直す */
export const SCHEMA_VERSION = "2";

/** 索引の状態。schema（表の版）、model（埋め込みの provider/model）、dim（埋め込みの次元） */
export interface MetaTable {
  key: string;
  value: string;
}

/** 索引に入れたファイル。更新時刻と大きさが変わったら行を入れ直す */
export interface FilesTable {
  path: string;
  mtime_ms: number;
  size: number;
}

/** 行の本文。同じ本文は 1 回だけ持つ。embedded は埋め込み済みなら 1 */
export interface TextsTable {
  id: Generated<number>;
  text: string;
  embedded: Generated<number>;
}

/** どのファイルの何行目がどの本文か。recorded_on は日付ファイルの日付（YYYY-MM-DD）、無ければ null */
export interface LinesTable {
  path: string;
  line: number;
  text_id: number;
  recorded_on: string | null;
}

export interface IndexDatabase {
  meta: MetaTable;
  files: FilesTable;
  texts: TextsTable;
  lines: LinesTable;
}

/**
 * 埋め込みは sqlite-vec の仮想テーブル vectors に、texts.id と同じ rowid で入れる。
 * 次元が埋め込みを取るまで決まらず、KNN の書き方も Kysely の外なので、ここでは作らず sql で触る
 */
export const createVectorsTable = (dim: number) =>
  sql`CREATE VIRTUAL TABLE vectors USING vec0(embedding float[${sql.raw(String(dim))}] distance_metric=cosine)`;

const strict = sql`STRICT`;

/** meta を無ければ作る。版を読む前に毎回呼ぶ */
export const ensureMetaTable = async (db: Kysely<IndexDatabase>): Promise<void> => {
  await db.schema.createTable("meta").ifNotExists()
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("value", "text", (c) => c.notNull())
    .modifyEnd(strict).execute();
};

/** 索引の中身の表を作る。無い前提なので、版が合わない時に dropIndexTables の後で呼ぶ */
export const createIndexTables = async (db: Kysely<IndexDatabase>): Promise<void> => {
  await db.schema.createTable("files")
    .addColumn("path", "text", (c) => c.primaryKey())
    .addColumn("mtime_ms", "integer", (c) => c.notNull())
    .addColumn("size", "integer", (c) => c.notNull())
    .modifyEnd(strict).execute();

  await db.schema.createTable("texts")
    .addColumn("id", "integer", (c) => c.primaryKey())
    .addColumn("text", "text", (c) => c.notNull().unique())
    .addColumn("embedded", "integer", (c) => c.notNull().defaultTo(0))
    .modifyEnd(strict).execute();

  await db.schema.createTable("lines")
    .addColumn("path", "text", (c) => c.notNull())
    .addColumn("line", "integer", (c) => c.notNull())
    .addColumn("text_id", "integer", (c) => c.notNull())
    .addColumn("recorded_on", "text")
    .addPrimaryKeyConstraint("lines_pk", ["path", "line"])
    .modifyEnd(strict).execute();
};

/** 索引の中身の表を全部消す。meta は版の記録なので残す */
export const dropIndexTables = async (db: Kysely<IndexDatabase>): Promise<void> => {
  for (const table of ["files", "texts", "lines"] as const) await db.schema.dropTable(table).ifExists().execute();
  await sql`DROP TABLE IF EXISTS vectors`.execute(db);
};
