// OpenAI 互換の決定的なスタブ。依存なし。
//
// 振る舞い:
//   - tools に memory_search があり、まだ tool の結果が無い → memory_search を呼ぶ tool_call を返す
//     引数の query は最後の user 発言そのまま
//   - tool の結果がある → "recalled: <結果の先頭>" を返す
//   - それ以外 → "echo: <最後の user 発言>"
// stream: true にも対応（SSE）
import http from "node:http";

const port = Number(process.env.PORT ?? 4000);

// OpenClaw は user 発言の前に内部文脈ブロックを足す。質問だけを取り出す
function stripInternalContext(text) {
  return text
    .replace(/<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>[\s\S]*?<<<END_OPENCLAW_INTERNAL_CONTEXT>>>/g, "")
    .replace(/^\[[^\]]*\]\s*/, "")          // 先頭の [Thu 2026-09-24 21:50 GMT+9]
    .replace(/\n\nRuntime:[\s\S]*$/, "")     // 末尾の Runtime: ... 行
    .trim();
}

function contentText(m) {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) return m.content.map((c) => c.text ?? "").join("");
  return "";
}

// 後ろから見て、内部文脈を剥いだ後に本文が残る最初の発言
function lastText(messages, role) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== role) continue;
    const text = stripInternalContext(contentText(m));
    if (text) return text;
  }
  return "";
}

function decide(body) {
  const messages = body.messages ?? [];
  const toolNames = (body.tools ?? []).map((t) => t.function?.name).filter(Boolean);
  const hasToolResult = messages.some((m) => m.role === "tool");
  const user = lastText(messages, "user");
  if (toolNames.includes("memory_search") && !hasToolResult) {
    return {
      toolCalls: [
        {
          id: "call_stub_1",
          type: "function",
          function: { name: "memory_search", arguments: JSON.stringify({ query: user.slice(0, 200) }) },
        },
      ],
    };
  }
  if (hasToolResult) return { text: `recalled: ${lastText(messages, "tool").slice(0, 400)}` };
  return { text: `echo: ${user.slice(0, 400)}` };
}

function completion(model, decision, stream) {
  const id = `chatcmpl-stub-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const message = decision.toolCalls
    ? { role: "assistant", content: null, tool_calls: decision.toolCalls }
    : { role: "assistant", content: decision.text };
  const finish = decision.toolCalls ? "tool_calls" : "stop";
  if (!stream) {
    return {
      id,
      object: "chat.completion",
      created,
      model,
      choices: [{ index: 0, message, finish_reason: finish }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    };
  }
  const delta = decision.toolCalls
    ? { role: "assistant", tool_calls: decision.toolCalls.map((c, index) => ({ index, ...c })) }
    : { role: "assistant", content: decision.text };
  return [
    { id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: null }] },
    { id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: finish }] },
  ];
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url?.startsWith("/v1/models")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ object: "list", data: [{ id: "stub", object: "model", owned_by: "hippoclaw" }] }));
    return;
  }
  if (req.method !== "POST" || !req.url?.startsWith("/v1/chat/completions")) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `no route ${req.method} ${req.url}` } }));
    return;
  }
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "invalid json" } }));
      return;
    }
    const decision = decide(body);
    console.log(JSON.stringify({ at: new Date().toISOString(), stream: !!body.stream, tools: (body.tools ?? []).length, decision }));
    if (process.env.STUB_DUMP) console.log(JSON.stringify(body.messages));
    if (!body.stream) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(completion(body.model ?? "stub", decision, false)));
      return;
    }
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    for (const chunk of completion(body.model ?? "stub", decision, true)) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
});

server.listen(port, "0.0.0.0", () => console.log(`stub model listening on ${port}`));
