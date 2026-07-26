<p align="center">
  <img src="https://img.shields.io/badge/version-3.0-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/Go-1.22%2B-00ADD8?logo=go" alt="go">
  <img src="https://img.shields.io/badge/C%2B%2B-17-00599C?logo=cplusplus" alt="c++">
</p>

<h1 align="center">Oxelia51</h1>

<p align="center">
  One-line config change. Complete token visibility.
  <br>
  A <strong>Token Usage Monitoring Platform</strong> built on Langfuse OSS
  <br>
  with a self-built Go proxy gateway and C++ analytics engine.
</p>

<p align="center">
  <a href="https://oxelia51.com">Live Demo</a> ·
  <a href="docs/README.md">Docs</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="README.md">中文</a>
</p>

---

## What is this?

How many tokens did you burn in Claude Code today? Which model costs the most? Which project is the most expensive?

Oxelia51 tracks **every LLM call** across all your AI tools — zero SDK, zero code changes.

```
Before:  Claude Code ────→ api.anthropic.com

After:   Claude Code ────→ oxelia51.com/api/proxy/anthropic ────→ api.anthropic.com
                               │
                               └── tokens recorded → real-time dashboard
```

**One environment variable.** That's it.

## Features

- 🔌 **Proxy-First** — Change one env var. No SDK, no code changes, no API key storage
- 📊 **Multi-Dimensional Stats** — By time, model, project, and session
- 💰 **Cost Tracking** — Built-in pricing for 20+ models, auto-calculated in USD
- 🚨 **Smart Alerts** — Budget thresholds + anomaly detection via email, webhook, or in-app
- 🌐 **China LLM Support** — DeepSeek, Moonshot, Zhipu out of the box
- 🏠 **5-Minute Self-Host** — `docker compose up -d`, your data never leaves your server
- 🎨 **Dual Themes** — Cozy (warm) / Cosmos (dark), toggle anytime
- 🔒 **Secure** — API keys are forwarded, never stored. 100% open source.

## Architecture

```
Your AI Tool
  │  change BASE_URL
  ▼
┌──────────────────────────────┐
│   Go Proxy Gateway            │  Forward requests + record tokens
│   Alibaba Cloud 2C2G :9090    │  6 LLM providers supported
└────────────┬─────────────────┘
             │ INSERT
             ▼
┌──────────────────────────────┐
│   ClickHouse                   │  Token event store (columnar OLAP)
│   Docker Compose               │  Millisecond aggregations
└────────────┬─────────────────┘
             │ SELECT
             ▼
┌──────────────────────────────┐
│   C++ Analytics Engine         │  Batch processing, every 5 min
│   Tencent Cloud 4C4G          │  Aggregate → Cost → Anomaly → Alert
└────────────┬─────────────────┘
             │ INSERT
             ▼
┌──────────────────────────────┐
│   PostgreSQL + Langfuse Web    │  Dashboard · Traces · Cost page
│   Tencent Cloud Docker Compose │  Forked Langfuse (MIT) + custom UI
└──────────────────────────────┘
```

## Quick Start

### Self-Host (5 minutes)

```bash
git clone https://github.com/XiaoleC05/Oxelia51.git
cd Oxelia51/deploy
cp .env.example .env
# edit .env with your secrets
docker compose up -d
```

Open `http://localhost:3000` → sign up → create project → get proxy URL.

### Configure Your AI Tool

```bash
# Claude Code
export ANTHROPIC_BASE_URL="https://oxelia51.com/api/proxy/anthropic"

# Cursor / ChatGPT
export OPENAI_BASE_URL="https://oxelia51.com/api/proxy/openai"
```

Token usage appears on your dashboard in real time.

## Tech Stack

| Component | Stack | Source | Size |
|-----------|-------|--------|:--:|
| Go Proxy Gateway | Go + stdlib `net/http/httputil` | Custom | ~2K LOC |
| C++ Analytics Engine | C++17 + `clickhouse-cpp` | Custom | ~3K LOC |
| Data Platform + UI | Langfuse (MIT) | Fork + Custom | — |
| Token Event Store | ClickHouse | Docker | — |
| Business Database | PostgreSQL 17 | Docker | — |
| Admin Panel | Go + Gin + React | Existing | — |

## Project Structure

```
Oxelia51/
├── proxy-gateway/        # Go proxy gateway
├── analytics/            # C++ analytics engine
├── backend/              # Admin panel (Go)
├── frontend/             # Admin UI (React, phasing out)
├── deploy/               # Docker Compose · Nginx · Webhook
├── docs/                 # Full documentation (6 docs + archive)
│   ├── README.md                # Doc index
│   ├── 1-feasibility.md         # Feasibility analysis
│   ├── 2-requirements.md        # Requirements
│   ├── 3-architecture.md        # Architecture & design
│   ├── 4-detailed-design.md     # Detailed design
│   ├── 5-deployment.md          # CI/CD & deployment
│   └── 6-maintenance.md         # Maintenance & operations
└── scripts/              # Utility scripts
```

## Documentation

See [docs/README.md](docs/README.md) for the full set:

| # | Document | Audience |
|:--:|----------|----------|
| 1 | Feasibility Analysis | Decision makers |
| 2 | Requirements | Product / Developers |
| 3 | Architecture | Developers |
| 4 | Detailed Design | Implementors |
| 5 | Deployment | DevOps |
| 6 | Maintenance | Operations |

## AI-Assisted Development

This project is built by 1 human developer + 4 AI agents. See [AGENTS.md](AGENTS.md) for how it works.

| Agent | Role |
|-------|------|
| Claude Code | Architecture, deployment, coordination |
| Qoder | Go backend |
| Trae Work | React frontend |
| Codex | Code review, testing, docs |

## Contributing

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add Gemini proxy support"    # new feature
git commit -m "fix: SSE stream data loss"          # bug fix
git commit -m "docs: update deployment guide"      # documentation
git commit -m "refactor: extract adapter interface" # refactor
```

## License

MIT License — see [LICENSE](LICENSE)
