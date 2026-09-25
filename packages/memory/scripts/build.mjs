// esbuild で 1 ファイルに束ね、コンテナにそのままマウントできる dist/ を作る。
// dist/ の中身: index.js, openclaw.plugin.json, package.json（openclaw.extensions だけ）
// openclaw/* は束ねない。実行時はホストの openclaw から解決される
import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const dist = path.join(pkgRoot, "dist");
const pkg = JSON.parse(await readFile(path.join(pkgRoot, "package.json"), "utf8"));

await mkdir(dist, { recursive: true });
await build({
  entryPoints: [path.join(pkgRoot, "src", "index.ts")],
  outfile: path.join(dist, "index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  external: ["node:*", "openclaw", "openclaw/*"],
  sourcemap: true,
  logLevel: "info",
});
await copyFile(path.join(pkgRoot, "openclaw.plugin.json"), path.join(dist, "openclaw.plugin.json"));
await writeFile(
  path.join(dist, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      type: "module",
      private: true,
      openclaw: { extensions: ["./index.js"] },
    },
    null,
    2,
  ) + "\n",
);
console.log(`built ${path.relative(process.cwd(), dist)}`);
