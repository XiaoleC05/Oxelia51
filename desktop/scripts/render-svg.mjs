#!/usr/bin/env node
/**
 * 把 SVG 渲染成指定尺寸 PNG（Edge headless CDP，1:1 像素）。
 * 用法：node render-svg.mjs <svg路径> <输出png> <尺寸>
 * 用于把官方品牌 SVG（final-icon-light.svg 等）栅格化为高分辨率位图。
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , svgPath, outPath, sizeArg] = process.argv;
const size = Number(sizeArg || 1024);
if (!svgPath || !outPath) {
  console.error("usage: node render-svg.mjs <svg> <out.png> <size>");
  process.exit(1);
}

const browser = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const port = 9270 + Math.floor(Math.random() * 100);
const profile = mkdtempSync(join(tmpdir(), "ox-svg-"));
const svg = readFileSync(svgPath, "utf-8");

// 包裹进 HTML，强制 width/height = size
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block}</style>
</head><body>${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`;
const htmlPath = join(profile, "index.html");
writeFileSync(htmlPath, html, "utf-8");

const edge = spawn(browser, [
  "--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars",
  `file://${htmlPath.replace(/\\/g, "/")}`,
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
  await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  // 透明背景：SVG 圆角外的透明区域保持透明，不被页面白底填充
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await sleep(1500);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  console.log(`saved ${outPath} (${size}x${size})`);
} catch (e) {
  console.error("render failed:", e.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  edge.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
