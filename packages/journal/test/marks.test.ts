import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Marks } from "../src/marks.ts";

test("無ければ undefined、書けば読める、開き直しても読める", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "hippoclaw-marks-"));
  const marks = new Marks(dir);

  assert.equal(await marks.lookup("main/s1"), undefined);
  await marks.register("main/s1", { cursor: "c1", at: 1 });
  await marks.register("main/s2", { cursor: "c2", at: 2 });

  marks.close();

  const reopened = new Marks(dir);
  assert.deepEqual(await reopened.lookup("main/s1"), { cursor: "c1", at: 1 });
  assert.deepEqual(await reopened.lookup("main/s2"), { cursor: "c2", at: 2 });
  reopened.close();
});

test("古い項目は register の時に落ちる", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "hippoclaw-marks-"));
  const marks = new Marks(dir, { maxAgeMs: 1000 });

  await marks.register("old", { cursor: "c", at: 0 });
  await marks.register("a", { cursor: "c", at: 500 });
  await marks.register("b", { cursor: "c", at: 1200 });

  assert.equal(await marks.lookup("old"), undefined, "1000ms より古い");
  assert.deepEqual(await marks.lookup("a"), { cursor: "c", at: 500 });
  assert.deepEqual(await marks.lookup("b"), { cursor: "c", at: 1200 });
  marks.close();
});
