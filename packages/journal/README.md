# hippoclaw-journal
dreaming 相当機能。
会話を溜めて、まとめて要約し、`memory/YYYY-MM-DD.md` に追記する。

## 管理予定

- トリガー類
  - `agent_end`
  - タイマー
  - `before_reset` (`/new`, `/reset`)
- 条件
  - 未要約の user 発言の合計文字数（`minChars`）
  - 無操作時間（`idleMinutes`）
- transcript の読み出し
  - sqlite の `transcript_events` を `seq` で読む。
- 要約状況の管理
  - セッション ID ごとに「どこまで処理したか」を保持
  - plugin の keyed store に保存
- 追記 (重複除去あり)

## その他
- `plugins.entries.memory-core.enabled: false`。純正 dreaming と同時には動かさない。
