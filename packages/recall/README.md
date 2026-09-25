# hippoclaw-recall
active-memory 相当機能。
毎ターン、着信した発言で記憶を検索し、結果をプロンプトに差し込む。

## 管理予定

- `registerMemoryPromptPreparation`（毎プロンプト前）
- 検索語
  - 着信発言そのもの、または分かち書き
- 検索
  - slot の capability 経由（`getMemoryCapabilityRegistration`）
  - 自分でファイルは読まない
- 圧縮
  - 上位 N 件、合計文字数で切る
  - 出典としてファイルパスと行番号を付ける
  - ヒットが無ければ何も置かない

## その他
- 純正 active-memory とは排他。`plugins.entries.active-memory.enabled: false`。
