# Oxelia51

Unified developer tool platform. One entry point for all online tools, with a single account and consistent experience.

## Features

- User registration with JWT authentication
- Tool directory with browsing and categorization
- Unified React frontend rendering for all tool interfaces; Go API gateway forwards requests to tool backends
- Admin dashboard for tool metadata CRUD
- Internal-only tool ports, not exposed to the public internet

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

## Development

| Module | Status |
|--------|--------|
| User system (register/login/JWT) | Completed |
| Tool directory (list/detail) | Completed |
| Admin dashboard (tool CRUD) | In progress |
| Landing page | Not started |
| API gateway | Not started |

## Deployment

```bash
# build and deploy with Docker Compose
docker compose -f docker/docker-compose.yml up -d --build
```

## Roadmap

- [ ] Platform landing page
- [ ] API gateway and request forwarding
- [ ] Frontend tool UI framework
- [ ] Standardized tool registration mechanism
- [ ] Integrate 5 online tools per ADR-004 via API gateway

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/xxx`)
3. Commit your changes (`git commit -m 'Add xxx'`)
4. Push the branch (`git push origin feature/xxx`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
