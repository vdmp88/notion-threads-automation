# Notion to Threads Content Automation

A learning-focused, production-minded Node.js application that will publish explicitly approved Notion content to a single Threads account.

> **Current status:** Phase 0 only. The repository contains architecture and prerequisite documentation, but no executable application or publishing code.

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

## Architecture

The approved architecture, data flow, reliability policy, and technology tradeoffs are documented in [docs/architecture.md](docs/architecture.md).

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

Currently available locally:

- Node.js `v24.1.0`
- npm `11.3.0`
- Git
- Docker (needed when MongoDB is introduced in Phase 4)

Node `v24.1.0` is sufficient for local development and the current MongoDB driver, but it is behind current Node 24 security releases. Upgrade to a current Node 24 LTS patch before production deployment.

External accounts are not needed for Phase 1. They will be created when their integrations begin:

- Phase 2: a Notion internal connection with read/update content access
- Phase 3: a Meta developer app configured for the Threads use case and a Threads Tester account
- Phase 4: local MongoDB through Docker
- Deployment: a separately approved free or low-cost MongoDB deployment

No paid infrastructure will be created without explicit approval.

## Environment variables

Copy `.env.example` to `.env` only when Phase 1 begins. Never commit `.env`.

`DRY_RUN` defaults to `true`. In dry-run mode, publishing is simulated and the application must not write to Threads, Notion, or the publication ledger.

Secrets such as Notion tokens, Threads access tokens, and the Threads app secret are server-only values. They must never appear in client-side code or logs.

## Development commands

There are no application commands yet. Phase 1 will add installation, development, linting, type-checking, and testing scripts.

For the current repository, the useful checks are:

```bash
git status
git diff --check
```

## Roadmap

- Phase 0: discovery, architecture, safe repository baseline — complete
- Phase 1: TypeScript/Fastify foundation and tests
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

- No application code exists yet.
- No Notion, Threads, or MongoDB connection has been configured.
- The Notion property schema has not yet been retrieved and validated.
- Threads publishing and metrics endpoints have not been called.
- The project is not production-ready.
