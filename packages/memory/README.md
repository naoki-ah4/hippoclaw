# hippoclaw-memory
memory-core 相当機能。
`plugins.slots.memory` を取る本体。許可リストで索引を作り、読み書きの口を出す。

## 管理予定

- `registerMemoryCapability`
  - `promptBuilder`（Memory 節）
  - `flushPlanResolver` は `null`
  - `runtime`（検索と読み出し）
- 索引
  - `include`（workspace 相対の glob）で対象を決め、`exclude` で外す
  - Markdown を読んで検索する
- ツール
  - `memory_search`
  - `memory_get`
- `/remember <本文>`
  - モデルを通さず `memory/YYYY-MM-DD.md` に追記

## その他
- 転写（sessions）は索引しない。`sessions_search` に任せる。
- `plugins.slots.memory: "hippoclaw-memory"`、`plugins.entries.memory-core.enabled: false`。
