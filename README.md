# Oxelia51

Unified developer tool platform. One entry point for all online tools, with a single account and consistent experience.

**Version**: v2.0

## Features

- User registration with JWT authentication (`account_id` as immutable login identifier)
- Tool directory with browsing, status badges, and categorization
- Unified React frontend rendering for all tool interfaces; Go API gateway forwards requests to tool backends
- Admin dashboard for tool metadata CRUD
- Internal-only tool ports, not exposed to the public internet
- Friends page (`/friends`) and user profile page (`/profile`)
- Server resource monitoring dashboard
- DormGuard QQ bot integration online

## Architecture

```text
Browser
  ↓
Nginx (reverse proxy)
  ↓
React Frontend (unified UI for all tools)
  ↓
Go API Layer (auth, tool registry, API gateway)
  ↓           ↓
PostgreSQL    Redis
(user/tool     (session cache,
 metadata)     task queue)

Internal API gateway:
  Go Backend → Tool A API (internal)
             → Tool B API (internal)
             → Tool C API (internal)
```

Each tool provides only a backend API without a standalone frontend. All UIs are rendered by the unified React application. The backend handles authentication, tool registration, and request forwarding.

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Backend | Go + Gin | Auth, tool registry, API gateway |
| Frontend | React + Vite | Unified UI for all tools |
| Database | PostgreSQL | User/tool metadata |
| Cache / Queue | Redis | Session cache, rate limiter |
| Deployment | Docker Compose + Nginx | 2-core 2GB cloud server |
| AI Collaboration | 5-agent model | Codex (Architecture), Cursor (Backend), Qoder Wake (Frontend), Qoder (QA & Deployment), Trae Work (Review & Knowledge) |

## Directory Structure

```text
Oxelia51/
├── backend/          # Go + Gin
│   ├── cmd/          # entry point
│   ├── internal/     # business logic
│   └── migrations/   # PostgreSQL migrations
├── frontend/         # React (Vite)
├── docker/           # Docker Compose
├── docs/             # development documents
├── README.md
└── README_CN.md
```

## Requirements

- Go 1.26+
- Node.js 24+
- PostgreSQL 17
- Redis 7
- Docker and Docker Compose

## Quick Start

```bash
# clone repository
git clone https://github.com/XiaoleC05/Oxelia51.git
cd Oxelia51

# start dependencies
docker compose up -d

# backend
cd backend
go run ./cmd/main.go

# frontend
cd frontend
npm install
npm run dev
```

## Configuration

Configuration is managed through environment variables. Copy `.env.example` to `.env` and fill in actual values:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: JWT signing key

## Usage

Visit [oxelia51.com](https://oxelia51.com), register an account, and enter the tool directory to start using tools.

## Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page (hero carousel + featured sections) |
| `/tools` | Tool directory |
| `/tools/:slug` | Tool shell (DormGuard, etc.) |
| `/portfolio` | Portfolio of projects |
| `/blog` | Blog listing |
| `/blog/:id` | Article detail |
| `/about` | About page |
| `/friends` | Friends links page |
| `/profile` | User profile (edit display name) |
| `/login` `/register` `/verify-email` `/forgot-password` `/reset-password` | Authentication flows |
| `/admin` | Admin dashboard |

## Development

| Module | Status |
|--------|--------|
| User system (register/login/JWT) | Completed |
| Tool directory (list/detail) | Completed |
| Admin dashboard (tool CRUD) | Completed |
| Landing page | Completed |
| API gateway | Completed |
| Friends / Profile pages | Completed |
| Server resource monitoring | Completed |
| DormGuard QQ bot | Completed |

## Deployment

```bash
# build and deploy with Docker Compose
docker compose -f docker/docker-compose.yml up -d --build
```

## Roadmap

- [x] Platform landing page
- [x] API gateway and request forwarding
- [x] Frontend tool UI framework
- [x] Standardized tool registration mechanism
- [x] Integrate 5 online tools per ADR-004 via API gateway
- [x] User profile page and `account_id` login identifier
- [x] Friends page
- [x] Server resource monitoring
- [x] DormGuard QQ bot integration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/xxx`)
3. Commit your changes (`git commit -m 'Add xxx'`)
4. Push the branch (`git push origin feature/xxx`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
