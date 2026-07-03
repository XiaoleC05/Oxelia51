# Oxelia51 — Developer Tool Service Platform

> One entry point for all your developer tools. One account, one experience.

## What Is Oxelia51?

Oxelia51 is a unified platform for developer tools. Rather than a scattered collection of separate services, users register one account and use all integrated tools within a single interface. Tools are rendered by the platform's React frontend, with the Go backend acting as an API gateway to forward requests to each tool's backend service. Users never leave the platform — no redirects, no fragmented experience.

## Architecture

```
Browser → oxelia51.com
              ├── React Frontend (unified UI for all tools)
              ├── Go Backend (auth, tool registry, API gateway)
              ├── PostgreSQL (user data, tool metadata)
              └── Redis (session cache, task queue)
                     │
                     ▼ Internal API forwarding
              ┌──────┼──────┬──────┐
            Tool A  Tool B  Tool C  Tool D
          (internal)(internal)(internal)(internal)
```

Each tool provides only a backend API — no standalone frontend. Tool ports are not exposed to the public internet.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go + Gin |
| Frontend | React (Vite) |
| Database | PostgreSQL 17 |
| Cache | Redis 7 |
| Deployment | Docker Compose + Nginx |
| API Style | REST |

## Platform Features

| Module | Status | Description |
|--------|--------|-------------|
| User System | ✅ | Registration, login, JWT authentication |
| Tool Directory | ✅ | Tool listing, detail pages |
| Admin Dashboard | 🔧 | Tool metadata management |
| Public Landing Page | ❌ | Platform introduction portal |

## Integrated Tools

| Tool | Description | Online | Desktop |
|------|-------------|--------|---------|
| DormGuard | Dormitory electricity monitoring | Personal | exe |
| MusicBox | Cross-platform music aggregator | Personal | exe |
| CS2Lab | CS2 utility training lab | All users | exe |
| SuperRead | AI RSS news briefing | All users | exe |
| AgentCanvas | AI agent process visualization | All users | exe |
| AIHelper | Prompt generator & optimizer | All users | exe |

## Repository Visibility

| Repository | Visibility | Write Access |
|------------|-----------|--------------|
| Oxelia51 (platform) | Public | Owner & authorized collaborators only |
| Tool projects | Public | Independently managed per repo |

Sensitive data (keys, passwords) is managed via `.env` and environment variables — never committed.

## How to Use

- **Online**: Visit [oxelia51.com](https://oxelia51.com), sign up and log in
- **Desktop**: Download exe installers from each tool's GitHub Releases

## Development Status

Phase 1 (platform skeleton) is complete: Go/Gin backend + React frontend + PostgreSQL + Redis + user auth + tool CRUD. Subsequent phases pending.

## Author

**Xiaole Cheng** — Full-stack developer focused on Go and practical developer tools.

- GitHub: [@XiaoleC05](https://github.com/XiaoleC05)
- Blog: [xiaolec05.github.io](https://xiaolec05.github.io)
