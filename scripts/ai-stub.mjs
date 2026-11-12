import { createServer } from "node:http";

// Local-only stand-in for Ollama. It lets the acceptance run exercise the real
// HTTP client, retry and UI without changing CONFIG.ai.baseUrl:
//   node scripts/ai-stub.mjs
//   curl "http://127.0.0.1:11434/control?mode=invalid"
// Modes: valid, invalid, truncated, wrong, absurd.
const port = Number(process.env.AI_STUB_PORT || 11434);
let mode = "valid";

const model = "qwen2.5:1.5b-instruct";
const models = [{ name: model, size: 1 }];

function feature(system) {
  if (system.includes("messy list of tasks")) return "planner";
  if (system.includes("short brain dump")) return "reframe";
  if (system.includes("shrink one task")) return "shrink";
  if (system.includes("re-order the rest")) return "replan";
  return "unknown";
}

function validReply(kind) {
  if (kind === "planner") {
    return JSON.stringify({
      tasks: [
        { title: "Email Sam", minutes: 10, load: "light" },
        { title: "Write the report", minutes: 30, load: "medium" },
      ],
    });
  }
  if (kind === "reframe") {
    return JSON.stringify({
      category: "avoidance",
      diagnosis: "The first step is unnamed, so the whole task feels larger.",
      action: "Open the document and read the first line.",
    });
  }
  if (kind === "shrink") {
    return JSON.stringify({ title: "Open the document", minutes: 5 });
  }
  return JSON.stringify({ order: [1, 0] });
}

function badReply(kind, selected) {
  if (selected === "invalid") return "this is not JSON";
  if (selected === "truncated") {
    return kind === "planner"
      ? '{"tasks":[{"title":"Cut off'
      : kind === "reframe"
        ? '{"category":"clarity"'
        : kind === "shrink"
          ? '{"title":"Open the file"'
          : '{"order":[0,1';
  }
  if (selected === "wrong") {
    if (kind === "planner") return JSON.stringify({ tasks: "not a list" });
    if (kind === "reframe") return JSON.stringify({ not: "a reading" });
    if (kind === "shrink") return JSON.stringify({ minutes: 5 });
    return JSON.stringify({ order: "nope" });
  }
  // absurd: shaped like the expected object but out of range or incomplete.
  if (kind === "planner") {
    return JSON.stringify({ tasks: [{ title: "Absurd", minutes: 999, load: "heavy" }] });
  }
  if (kind === "reframe") {
    return JSON.stringify({
      category: "clarity",
      diagnosis: "The next step is unclear.",
      action: "x".repeat(400),
    });
  }
  if (kind === "shrink") {
    return JSON.stringify({ title: "Absurd", minutes: 999 });
  }
  return JSON.stringify({ order: [0, 0, 1] });
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/control") {
    const requested = url.searchParams.get("mode");
    if (requested) mode = requested;
    send(response, 200, { mode });
    return;
  }
  if (url.pathname === "/api/tags") {
    send(response, 200, { models });
    return;
  }
  if (url.pathname !== "/api/chat") {
    send(response, 404, { error: "not found" });
    return;
  }

  let raw = "";
  request.on("data", (chunk) => {
    raw += chunk;
  });
  request.on("end", () => {
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      send(response, 400, { error: "bad request" });
      return;
    }
    const system = String(body.messages?.[0]?.content ?? "");
    const kind = feature(system);
    const content = mode === "valid" ? validReply(kind) : badReply(kind, mode);
    console.log(`${mode} ${kind} ${request.socket.remotePort}`);
    send(response, 200, { model: body.model || model, message: { role: "assistant", content } });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AI stub on http://127.0.0.1:${port} (mode ${mode})`);
});
