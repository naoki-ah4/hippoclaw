#!/bin/sh
# 検証用モデルの provisioning。up のたびに走り、冪等。
# 賢いモデルは要らない。hippoclaw の目的 2（小さいモデルでも記憶を使いこなす）に
# 合わせて、本番で tool call を崩した実効 2B の e2b を検証の基準にする。
set -e

# 公式の QAT 版。~/openclaw の provision.sh と同じ流儀で -it-qat を付ける
ollama pull gemma4:e2b-it-qat

# num_ctx を広げた派生。既定の num_ctx では OpenClaw のシステムプロンプトが切り詰められる
ollama create gemma4:e2b-dev -f /models/gemma4-e2b-dev.Modelfile

# 埋め込み。後で store に意味検索を足すときに使う
ollama pull bge-m3

ollama list
