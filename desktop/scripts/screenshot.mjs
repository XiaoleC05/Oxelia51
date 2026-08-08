#!/usr/bin/env node
/**
 * 验收截图：无头 Edge (CDP) 打开页面 → 切主题/切 Tab → 截图。
 * 用法：node screenshot.mjs <url> <out.png> [--theme cosmos|cozy] [--tab 0..4] [--wait ms]
 * 需要系统装有 Edge/Chrome；通过 --browser 指定（默认 msedge）。
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
if (!url || !out) {
  console.error("usage: node screenshot.mjs <url> <out.png> [--theme t] [--tab n] [--wait ms] [--browser path]");
  process.exit(1);
}
const theme = args.includes("--theme") ? args[args.indexOf("--theme") + 1] : "cosmos";
const tabIdx = args.includes("--tab") ? Number(args[args.indexOf("--tab") + 1]) : 0;
const waitMs = args.includes("--wait") ? Number(args[args.indexOf("--wait") + 1]) : 3500;
const browser = args.includes("--browser")
  ? args[args.indexOf("--browser") + 1]
  : "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const port = 9223 + Math.floor(Math.random() * 200);
const profile = mkdtempSync(join(tmpdir(), "ox-shots-"));

const edge = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--window-size=1280,800",
  url,
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;

try {
  // 等调试端口就绪
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {}
    await sleep(250);
  }
  if (!targets?.length) throw new Error("CDP target not ready");
  const page = targets.find((t) => t.type === "page") ?? targets[0];
  ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message));
      else p.resolve(m.result);
    }
  };
  await new Promise((r) => (ws.onopen = r));

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
  await sleep(waitMs); // 等数据加载/轮询

  if (theme !== "cosmos") {
    await send("Runtime.evaluate", { expression: `document.querySelector('.theme-toggle')?.click()` });
    await sleep(400);
  }
  if (tabIdx > 0) {
    await send("Runtime.evaluate", { expression: `document.querySelectorAll('.tab')[${tabIdx}]?.click()` });
    await sleep(1200);
  }

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(`saved ${out} (theme=${theme} tab=${tabIdx})`);
} catch (e) {
  console.error("screenshot failed:", e.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  edge.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
