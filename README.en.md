<p align="center"><a href="README.md">中文</a> · <b>English</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.x-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/Go-1.22%2B-00ADD8?logo=go" alt="go">
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri" alt="tauri">
</p>

<h1 align="center">Oxelia51</h1>

<p align="center">
  One-line config change. Complete token visibility.
  <br>
  A local-first personal token ledger · MIT licensed
</p>

<p align="center">
  <a href="https://oxelia51.com/download">Download Desktop</a> ·
  <a href="https://oxelia51.com/docs">Docs</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="https://github.com/XiaoleC05/Oxelia51">GitHub</a>
</p>

---

## What is this?

How many tokens did you burn in Claude Code, Cursor, CC Switch, or Trae today? Which provider or agent costs the most?

Oxelia51 tracks **every LLM call** across all your AI tools — zero SDK, zero code changes. Point your model tool's Base URL at the bundled local proxy and every request is recorded automatically.

```
Before:  Claude Code ────→ api.anthropic.com

After:   Claude Code ────→ http://127.0.0.1:17800/api/proxy/anthropic ────→ api.anthropic.com
                              │
                              └── tokens + cost recorded → real-time dashboard
```

**One environment variable.** That's it. No SDK, no code changes, no API keys stored.

## Highlights

- 🖥️ **Local-first desktop app** (Tauri 2, Windows/macOS/Linux) — data lives in local SQLite; no login or network required
- 🔌 **One-line env var to connect** — zero-invasion proxy; API keys are forwarded, never stored
- 📊 **Two dimensions** — aggregate tokens, requests & cost by **provider** (Claude / DeepSeek / OpenAI / Zhipu …) and **agent** (Claude Code / Cursor / CC Switch / Trae …), drill down to per-model detail
- 🪟 **Floating glass widget** — a desktop-pinned, always-on-top card showing today's tokens & cost in real time
- 🗂️ **80+ preset providers** — grouped as Global / China / Third-party, with search, one-click copy of the proxy address, and direct links to each official site
- 💰 **Model price reference** — sort by input price or blended cost to compare models (reference prices, offline)
- 🚨 **Four-dimension alerts** — per-global / provider / agent / model budgets with system notifications
- 🎨 **Dual themes** — Cozy (warm) / Cosmos (dark), toggle anytime
- ☁️ **Cross-device sync** — sign in with your cloud platform account to upload/download the local ledger; multiple devices merge with per-event dedup, and data only uploads when you sync manually

## Quick Start

### 1. Download the desktop app

Grab the installer for your platform from the [download page](https://oxelia51.com/download) or GitHub Releases, then launch it. A local proxy starts automatically at `127.0.0.1:17800`.

### 2. Configure your AI tool

Pick a provider and point your model tool's Base URL at the local proxy address (**must include the `/api/proxy/<provider-slug>` prefix**):

```bash
# Anthropic protocol (Claude Code / Anthropic SDK):
export ANTHROPIC_BASE_URL="http://127.0.0.1:17800/api/proxy/anthropic"

# OpenAI-compatible tools (Cursor / CC Switch / Trae …), swap the slug:
export OPENAI_BASE_URL="http://127.0.0.1:17800/api/proxy/deepseek"
```

For tools with a custom Base URL field (e.g. CC Switch), just paste `http://127.0.0.1:17800/api/proxy/<slug>` directly.

### 3. Watch

Every call is recorded from then on. View usage and cost by provider / agent / model in the app; click the "floating stats" button in the top bar to pin a live widget to your desktop.

## Providers

76 provider routes ship with the app (proxy-gateway/internal/adapter/registry.go), in three groups:

- **Global**: Anthropic / OpenAI / Gemini / Mistral / Grok / Groq / Cerebras / Cohere / Perplexity / SambaNova / NVIDIA …
- **China**: DeepSeek / Zhipu GLM / Qwen / Moonshot (Kimi) / Kimi For Coding / Doubao / Tencent Hunyuan / iFlytek Spark / MiniMax / Baichuan / Yi / SenseNova / StepFun / SiliconFlow / Gitee AI / ModelScope / Baidu Qianfan …
- **Third-party / aggregators**: OpenRouter / Together AI / Fireworks / DeepInfra / Novita / PPIO / and various API resellers …

> Provider = the LLM platform; **Agent = the software you use**. The agent is auto-detected from the User-Agent (or overridable via the `X-Oxelia51-Agent` header).

## Architecture

```
Your AI tool (Claude Code / Cursor / …)
  │  change BASE_URL
  ▼
┌─────────────────────────────────────┐
│ Local proxy gateway (Go, :17800)      │ forward + record (LOCAL_MODE)
│ proxy-gateway/                       │ 76 provider routes
└──────────────┬──────────────────────┘
               │ INSERT
               ▼
┌─────────────────────────────────────┐
│ SQLite (local ledger)                │ token_events
└──────────────┬──────────────────────┘
               │ optional: sign in to sync
               ▼
┌─────────────────────────────────────┐
│ Cloud platform (oxelia51.com)        │ sync / view / restore
└─────────────────────────────────────┘
```

The product formerly spanned two repositories; langfuse-token has been merged into this repo as `web/`:

| Location | Contents | Notes |
| --- | --- | --- |
| **Oxelia51** (this repo) | Go proxy gateway `proxy-gateway/`, Go backend `backend/`, desktop app `desktop/`, analytics engine `analytics/` | All first-party code, evolves independently |
| **web/** (this repo) | web frontend: landing page / docs / dashboard | Former langfuse-token repo (Langfuse MIT fork + deep customization); detached and merged into this repo, langfuse-native features (tracing/prompts/evals) removed, evolves independently |

## Project Structure

```
Oxelia51/
├── proxy-gateway/        # Go proxy gateway (cloud + local sidecar), 76 provider routes
├── backend/              # Go backend (auth / admin / cross-device sync)
├── desktop/              # Desktop app (Tauri 2 + Vite React + sidecar)
│   ├── ui/               #   UI (main window + floating glass widget)
│   └── src-tauri/        #   Tauri shell + sidecar hosting
├── analytics/            # C++ analytics engine
├── web/                  # web frontend (former langfuse-token repo, detached & merged into this repo)
├── packages/shared/      # @oxelia51/shared: shared package for web (Prisma/ClickHouse/domain constants)
├── deploy/               # Docker Compose · Nginx · release scripts
├── docs/                 # Full documentation (design / deploy / ops)
└── scripts/              # Utility scripts
```

## Local Development (web)

```bash
pnpm install           # install deps (pnpm 11; node 22 works, engines warning is safe to ignore)
pnpm run db:generate   # generate Prisma client (scripts read root .env; see .env.dev.example)
pnpm run build         # build packages/shared and web via turbo
```

Windows note: web's `build`/`dev` scripts rely on dotenv and a Unix shell — run them in Git Bash,
or directly (green = route table printed):

```bash
cd web && DOCKER_BUILD=1 INLINE_RUNTIME_CHUNK=false NEXT_TELEMETRY_DISABLED=1 pnpm exec next build
```

See [web/AGENTS.md](web/AGENTS.md) and [packages/shared/AGENTS.md](packages/shared/AGENTS.md) for details.

## Documentation

- Online docs: [oxelia51.com/docs](https://oxelia51.com/docs)
- Local design docs: [docs/README.md](docs/README.md)
- v4 product design: [2026-08-08-oxelia51-v4-design.md](https://github.com/XiaoleC05/langfuse-token/blob/main/docs/superpowers/specs/2026-08-08-oxelia51-v4-design.md) (archived former langfuse-token repo; doc not migrated into this repo)

## Contributing

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add Gemini proxy support"     # new feature
git commit -m "fix: SSE stream data loss"          # bug fix
git commit -m "docs: update deployment guide"      # documentation
git commit -m "refactor: extract adapter interface" # refactor
```

## License

MIT License — see [LICENSE](LICENSE)
