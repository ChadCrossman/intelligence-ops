# Publish Weaver Intelligence Ops

A Windows 11 friendly React/Vite/TypeScript starter for managing multiple AI governance search queries, scheduling runs, processing article results, ranking the top X, and preparing blog and email synopsis workflows.

This starter intentionally avoids Docker. It is designed to run on a dedicated Windows 11 PC using Node.js, pnpm, and optionally PostgreSQL later.

## What is included

- React + Vite + TypeScript front end
- Fastify + TypeScript backend
- Shared domain types package
- File-backed JSON storage for immediate local use
- Query definitions dashboard
- Query scheduling controls
- Manual "Run now" processing
- Mock search provider
- Relevance scoring
- Blog draft placeholder generation
- Email synopsis placeholder generation
- VS Code and Codex working guide

## Prerequisites on Windows 11

Install:

1. Node.js LTS
2. pnpm
3. Git
4. Visual Studio Code
5. OpenAI Codex VS Code extension

Recommended PowerShell commands:

```powershell
corepack enable
corepack prepare pnpm@latest --activate
node --version
pnpm --version
```

## Run locally

From the project root:

```powershell
pnpm install
pnpm dev
```

Open:

```text
http://localhost:5185
```

The API runs on:

```text
http://localhost:3150
```

## Environment variables

Create local environment variables for the API process before running searches:

```powershell
$env:BRAVE_SEARCH_API_KEY="your_brave_search_api_key"
pnpm dev:api
```

For persistent local configuration, copy `.env.example` to your own local environment file or set user-level Windows environment variables. API keys are server-side only; do not add Brave, OpenAI, or email provider keys to `apps/web` or any `VITE_` variable.

Future PostgreSQL-backed storage should read its connection string from:

```powershell
$env:LABELS_DATABASE_URL="postgresql://postgres<Password>@localhost:5432/PublishWeaver?sslmode=disable"
```

## Search architecture

Search runs through an API-side orchestrator:

```text
Query pipeline
  -> SearchOrchestrator
    -> Brave provider
    -> Future: Bing, Google, RSS, News APIs, Reddit/X/LinkedIn, regulatory feeds
```

The MVP registers Brave as the only real provider. The orchestrator is responsible for fan-out across providers and URL deduplication before the pipeline scores, ranks, and selects the top results. Future provider selection, weighting, and per-query provider controls should update the shared API/UI types together.

## Development commands

```powershell
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm build
pnpm test
pnpm typecheck
```

## Production on a dedicated Windows 11 PC

For a simple always-on setup, use PM2:

```powershell
npm install -g pm2
pnpm build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

PM2 on Windows may require running the generated startup command from an elevated shell.

## Where to extend next

Replace these placeholder services:

```text
apps/api/src/services/blogGenerator.ts
apps/api/src/services/emailSynopsis.ts
apps/api/src/services/storage.ts
```

Recommended next integrations:

- Database: PostgreSQL
- Queue: BullMQ + Redis or a PostgreSQL-backed job table
- LLM: OpenAI Responses API
- Email: Resend, SendGrid, Brevo, or Mailchimp

## Codex workflow

See:

```text
docs/CODEX_VSCODE_GUIDE.md
```
