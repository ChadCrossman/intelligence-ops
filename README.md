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
http://localhost:5173
```

The API runs on:

```text
http://localhost:3001
```

## Development commands

```powershell
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm build
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
apps/api/src/services/searchProvider.ts
apps/api/src/services/blogGenerator.ts
apps/api/src/services/emailSynopsis.ts
apps/api/src/services/storage.ts
```

Recommended next integrations:

- Search: Brave Search API, Bing Web Search API, Google Programmable Search, SerpAPI, or RSS feeds
- Database: PostgreSQL
- Queue: BullMQ + Redis or a PostgreSQL-backed job table
- LLM: OpenAI Responses API
- Email: Resend, SendGrid, Brevo, or Mailchimp

## Codex workflow

See:

```text
docs/CODEX_VSCODE_GUIDE.md
```
