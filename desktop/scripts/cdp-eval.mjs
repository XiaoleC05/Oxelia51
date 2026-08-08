#!/usr/bin/env node
/**
 * 无头 Edge CDP 求值：导航 → 等待 → 执行表达式 → 打印结果 JSON。
 * 用法：node cdp-eval.mjs <url> <expr> [--wait ms]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , url, expr] = process.argv;
const waitMs = process.argv.includes("--wait") ? Number(process.argv[process.argv.indexOf("--wait") + 1]) : 4000;
if (!url || !expr) {
  console.error("usage: node cdp-eval.mjs <url> <expr> [--wait ms]");
  process.exit(1);
}
const browser = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const port = 9240 + Math.floor(Math.random() * 100);
const profile = mkdtempSync(join(tmpdir(), "ox-eval-"));
const edge = spawn(browser, [
  "--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, "--no-first-run", "--window-size=1280,800", url,
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {}
    await sleep(250);
  }
  const page = targets?.find((t) => t.type === "page") ?? targets?.[0];
  ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  };
  await new Promise((r) => (ws.onopen = r));
  await send("Page.enable");
  await send("Runtime.enable");
  await sleep(waitMs);
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify(r.result?.value ?? null, null, 0));
} catch (e) {
  console.error("eval failed:", e.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  edge.kill(); await sleep(300); rmSync(profile, { recursive: true, force: true });
}
