# Notion to Threads Content Automation

A learning-focused, production-minded Node.js application that will publish explicitly approved Notion content to a single Threads account.

> **Current status:** Phase 1 foundation is complete. The project has a tested health server, validated base configuration, and a temporary in-memory `GET /posts` learning route, but no Notion, Threads, or MongoDB integration yet.

## MVP goal

The first working version will:

1. Read a Notion page whose editorial status is `ready`.
2. Map the external response to an internal `ContentPost` model.
3. Validate the post text.
4. Simulate the workflow by default with `DRY_RUN=true`.
5. After explicit approval and with dry-run disabled, publish one text post to Threads.
6. Store a publication record in MongoDB.
7. Write the post ID, URL, timestamp, and `published` status back to Notion.
8. Refuse to automatically publish the same Notion page twice.

AI generation, webhooks, scheduled posts, queues, multi-user authentication, analytics history, and a dashboard are outside the MVP.

## Project documentation

- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md): current implementation state and next checkpoint
- [docs/architecture.md](docs/architecture.md): approved architecture, data flow, and reliability policy
- [docs/roadmap.md](docs/roadmap.md): learning track and product phases
- [docs/decisions/](docs/decisions/): durable explanations of important architectural decisions
- [AGENTS.md](AGENTS.md): working instructions for Codex and other coding agents

## Technology decisions

- Node.js 24 and TypeScript with ES modules
- npm
- Fastify
- Zod runtime validation
- Pino structured logging through Fastify
- official Notion JavaScript SDK
- native `fetch` for the Threads API
- official MongoDB Node.js driver without an ODM
- Vitest, ESLint, and Prettier
- one codebase with separate HTTP and CLI entry points

## Prerequisites

Required locally:

- Node.js 24 LTS (`>=24.1.0 <25`)
- npm 11 or newer
- Git
- Docker (installed but not used in the current phase)

Use a current security-patched Node 24 release. If npm reports `EBADENGINE` while using Node 26, switch the terminal back to Node 24 rather than weakening the project's supported-runtime rule.

External accounts have not been configured. They will be created when their integrations begin:

- Phase 2: a Notion internal connection with read/update content access
- Phase 3: a Meta developer app configured for the Threads use case and a Threads Tester account
- Phase 4: MongoDB, with the local execution method confirmed before implementation
- Deployment: a separately approved free or low-cost MongoDB deployment

No paid infrastructure will be created without explicit approval.

## Environment variables

The server runs with safe defaults without a local `.env`. Copy `.env.example` to `.env` when you need to override local settings. Never commit `.env`.

`DRY_RUN` defaults to `true`. In dry-run mode, publishing is simulated and the application must not write to Threads, Notion, or the publication ledger.

Secrets such as Notion tokens, Threads access tokens, and the Threads app secret are server-only values. They must never appear in client-side code or logs.

## Development commands

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

The server listens on `http://127.0.0.1:3000` by default. Check it with:

```bash
curl http://127.0.0.1:3000/health
```

Run the complete local quality checks:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run format:check
```

## Roadmap

- Phase 0: discovery, architecture, safe repository baseline — complete
- Phase 1: TypeScript/Fastify foundation and tests — complete
- Phase 2: Notion schema inspection and mapping
- Phase 3: Threads authentication and an explicitly approved test post
- Phase 4: idempotent publishing workflow backed by MongoDB
- Phase 5: safe recurring execution
- Phase 6: analytics synchronization
- Phase 7: production reliability
- Phase 8: deployment
- Phase 9: optional, approval-gated AI features

## Security baseline

- Secrets live in environment variables, never source code.
- External inputs and API responses are validated.
- HTTP requests use timeouts.
- Access tokens are redacted from logs and error details.
- A real Threads post always requires `DRY_RUN=false` and explicit human confirmation.
- An ambiguous publish result is never retried automatically.

## Current limitations

- The health route and application foundation exist; publishing is not implemented.
- `GET /posts` returns temporary in-memory learning data and is not a production content source.
- No Notion, Threads, or MongoDB connection has been configured.
- The Notion property schema has not yet been retrieved and validated.
- Threads publishing and metrics endpoints have not been called.
- The project is not production-ready.
