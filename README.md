# hippoclaw

OpenClaw の記憶を制御可能にするプラグイン群。純正の memory-core、active-memory、dreaming に
それぞれ対応する 3 つのプラグインからなる。

## 目的

- インデックスに入れるファイルを制御可能にする
- パラメータ数の少ないモデルでも記憶を使いこなせるようにする
- 雑談に耐えられるエージェントにする

## 構成

pnpm workspace。1 プラグインにつき 1 パッケージ。

| パッケージ | プラグイン id | 相当する純正 | 役割 |
|---|---|---|---|
| [`packages/memory`](packages/memory/README.md) | `hippoclaw-memory` | memory-core | `plugins.slots.memory` を取る本体。許可リストで索引を作り、読み書きの口を出す |
| [`packages/recall`](packages/recall/README.md) | `hippoclaw-recall` | active-memory | 毎ターン記憶を検索してプロンプトに差し込む |
| [`packages/journal`](packages/journal/README.md) | `hippoclaw-journal` | dreaming | 会話を溜めて要約し、記憶ファイルに追記する |

recall は純正の active-memory と排他。賢いモデルを使うなら純正でよい。
memory-core と dreaming は使わない。

## 検証

`sandbox/` に検証用の compose プロジェクトがある。使い方は [sandbox/README.md](sandbox/README.md)。

