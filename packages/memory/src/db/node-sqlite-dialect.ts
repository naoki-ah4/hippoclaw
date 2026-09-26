import { SqliteDialect, type SqliteDatabase } from "kysely";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";

const isSqlValue = (v: unknown): v is SQLInputValue =>
  v === null ||
  typeof v === "number" ||
  typeof v === "bigint" ||
  typeof v === "string" ||
  typeof v === "boolean" ||
  ArrayBuffer.isView(v);

/**
 * Kysely が渡す引数を、node:sqlite が受け付ける値に絞る。それ以外が来たら投げる。
 * node:sqlite は object を名前付きの引数の辞書として読むので、Date などは例外にならずに空のまま結び付けられてしまう
 */
const params = (values: ReadonlyArray<unknown>): SQLInputValue[] =>
  values.map((v) => {
    if (isSqlValue(v)) return v;
    throw new TypeError(`node:sqlite cannot bind ${typeof v}`);
  });

export const nodeSqliteDialect = (db: DatabaseSync): SqliteDialect => {
  const database: SqliteDatabase = {
    close: () => db.close(),
    prepare: (query) => {
      const statement = db.prepare(query);
      return {
        // Kysely の SqliteDialect は、文が結果の行を返すかどうか（reader）を知りたがる。
        // node:sqlite の文はそれを持たないので、結果の列が一つ以上あるかで決める
        reader: statement.columns().length > 0,
        all: (values) => statement.all(...params(values)),
        run: (values) => statement.run(...params(values)),
        iterate: (values) => statement.iterate(...params(values)),
      };
    },
  };

  return new SqliteDialect({ database });
};
