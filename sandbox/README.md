# sandbox — 検証コンテナ

`~/openclaw` の 2 体とは別の compose プロジェクト。Discord も Matrix も繋がず、
ollama も専用のものを持つ（volume も network も別）。

```sh
pnpm build                          # packages/memory/dist を作る。コンテナはここを読む
pnpm sandbox:inspect                    # モデル無し。スロット選択・ツール登録・SDK import の失敗を見る
pnpm sandbox:exec "プリウスの色は？"      # スタブモデルで 1 ターン
pnpm sandbox:up:ollama                  # 専用 ollama を上げ、モデルを入れる（初回は DL が走る）
pnpm sandbox:exec:ollama "プリウスの色は？"  # gemma4:e2b-dev で 1 ターン
pnpm sandbox:gateway:up                 # Gateway を上げる（ollama も一緒に）。HIPPOCLAW_MODEL で gateway のモデルを決める
pnpm sandbox:chat "プリウスの色は？"          # Gateway 経由で 1 ターン。active-memory のようにツール認可が要るフックはこちらでしか走らない
pnpm sandbox:gateway:restart            # plugin を build し直したら再起動が要る
pnpm sandbox:down                       # 全部落とす。モデルの volume は残る
```

`agent exec` は一発実行で、ツール認可の指紋を持たない。認可が要る `before_prompt_build`（active-memory）は
そこでは走らないので、active-memory を試すときは Gateway 経由の `sandbox:chat` を使う。

- `state/` は git に入れない。壊れたら消してよい
- `workspace/` が agent の workspace。`memory/dreaming/` は include 外の見本
- `stub-model/` は OpenAI 互換の決定的なスタブ。tools に `memory_search` があれば必ず 1 回呼ぶ
- `ollama/` はモデルの provisioning。賢いモデルは入れない。基準は実効 2B の `gemma4:e2b-dev`
- 別のモデルで回すときは `HIPPOCLAW_MODEL=ollama/<name> docker compose -f sandbox/compose.yaml --profile ollama run --rm sandbox agent exec ...`
