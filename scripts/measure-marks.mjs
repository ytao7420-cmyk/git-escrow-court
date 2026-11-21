import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const chrome = process.env.CHROME || "google-chrome";
const port = 9233;
const url = process.env.MARK_URL || "http://127.0.0.1:43123/";

function launch() {
  return spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${port}`,
      "--window-size=1280,900",
      "--no-first-run",
      "--user-data-dir=/tmp/mark-chrome",
      url,
    ],
    { stdio: "ignore" },
  );
}

async function cdp() {
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = pages.find((item) => item.type === "page");
  if (!page) throw new Error("no page target");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", reject);
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) pending.get(message.id)(message);
  });
  function send(method, params = {}) {
    const messageId = ++id;
    return new Promise((resolve) => {
      pending.set(messageId, resolve);
      socket.send(JSON.stringify({ id: messageId, method, params }));
    });
  }
  return { socket, send };
}

const child = launch();
try {
  let version;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      version = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (version.ok) break;
    } catch {
      await delay(200);
    }
  }
  const { socket, send } = await cdp();
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url });
  await delay(2500);
  const evaluated = await send("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll("[data-mark]")].map((node) => {
      const box = node.getBoundingClientRect();
      return { alt: node.dataset.mark, width: box.width, height: box.height, ratio: box.width / box.height, expected: Number(node.dataset.ratio) };
    }))`,
    returnByValue: true,
  });
  if (!evaluated.result?.result?.value) {
    console.error(JSON.stringify(evaluated).slice(0, 800));
    process.exit(1);
  }
  const marks = JSON.parse(evaluated.result.result.value);
  let failed = false;
  for (const mark of marks) {
    const delta = Math.abs(mark.ratio - mark.expected) / mark.expected;
    const ok = delta < 0.02 && mark.width > 0 && mark.height > 0;
    console.log(`${ok ? "ok" : "BAD"} ${mark.alt} ${mark.width.toFixed(1)}x${mark.height.toFixed(1)} ratio ${mark.ratio.toFixed(4)} expected ${mark.expected} delta ${(delta * 100).toFixed(2)}%`);
    if (!ok) failed = true;
  }
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const bytes = Buffer.from(shot.result.data, "base64");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("artifacts/screenshots", { recursive: true });
  writeFileSync("artifacts/screenshots/marks-ratio.png", bytes);
  socket.close();
  if (marks.length !== 3 || failed) process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
}
