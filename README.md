# Notion to X (Twitter) Content Automation

A learning-focused, production-minded Node.js application that will publish explicitly approved Notion content to a single X account.

> **Current status:** Phase 1 foundation is complete. Phase 2 is in progress: the user successfully ran `notion:inspect` and retrieved one ready post with `notion:posts`. Publication validation, publishing, and MongoDB integration remain to be implemented.

## Naming and scope

The publishing target is **X (Twitter)**, following the user's decision on 2026-09-08. Threads is no longer part of the product plan. [ADR 004](docs/decisions/004-target-x-twitter.md) records the change.

The local folder/npm package and Notion connection still use `notion-threads-automation`; the existing Notion database is still titled `Threads Posts`. These are retained names, not a second publishing target. Keep using the existing folder, database IDs, and connection. The package description and temporary `GET /posts` mock field `threadsUrl` also retain their old names; no production publisher exists. New planned publication fields are `xPostId` and `xUrl`.

## MVP goal

The first working version will:

1. Read a Notion page whose editorial status is `ready`.
2. Map the external response to an internal `ContentPost` model.
3. Validate the post text.
4. Simulate the workflow by default with `DRY_RUN=true`.
5. After explicit approval and with dry-run disabled, publish one text post to X.
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
- native `fetch` for the X API
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

External integration setup:

- Phase 2: a Notion internal connection and the Threads Posts database are configured; read access was verified. Update access will be needed later.
- Phase 3: an X developer app with user-context write authorization; verify current API access, pricing, and applicable limits before setup. This phase has not started.
- Phase 4: MongoDB, with the local execution method confirmed before implementation
- Deployment: a separately approved free or low-cost MongoDB deployment

No paid infrastructure or paid X API usage will be enabled without explicit approval. Phase 3 must confirm the actual access and cost for the user before any paid calls.

## Environment variables

The server runs with safe defaults without a local `.env`. Copy `.env.example` to `.env` when you need to override local settings. Never commit `.env`.

`DRY_RUN` defaults to `true`. In dry-run mode, publishing is simulated and the application must not write to X, Notion, or the publication ledger.

Notion tokens and the X credentials required by the selected authentication flow are server-only values. They must never appear in client-side code or logs.

Unused Threads/Meta settings have been removed from `.env.example`. X-specific settings will be added when the Phase 3 authentication flow is selected. Existing local Notion settings are unchanged.

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

Inspect the connected Notion data source from the project root:

```bash
npm run notion:inspect
```

This finite command loads local `.env` settings, validates `NOTION_ACCESS_TOKEN` and `NOTION_DATA_SOURCE_ID`, and prints the source title, property types, and select/status options. It only reads schema metadata and makes no external writes, regardless of `DRY_RUN`. The HTTP server does not need to be running. Keep `DRY_RUN=true` for future publishing work. This command does not yet check the schema against the expected post model.

Preview posts with Status equal to `ready`:

```bash
npm run notion:posts
```

This command reads all result pages and prints `{ count, posts }` with each post's Notion page ID, title, text, topic, and status. No matching posts produces `{ "count": 0, "posts": [] }`. It checks the four property types on returned posts and fails on incomplete entries rather than presenting them as valid posts. A ready post with empty or whitespace-only Text stops the command with exit code 1 and an error containing the Notion page ID; no partial preview is printed. Nonempty text keeps its original spacing and line breaks. The command makes no external writes, regardless of `DRY_RUN`. Preview output is not publication approval: length limits, the full ContentPost model, and duplicate protection are still pending.

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
- Phase 3: X authentication and an explicitly approved test post
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
- A real X post always requires `DRY_RUN=false` and explicit human confirmation.
- An ambiguous publish result is never retried automatically.

## Current limitations

- The health route and application foundation exist; publishing is not implemented.
- `GET /posts` returns temporary in-memory learning data and is not a production content source.
- The read-only Notion schema CLI works. X and MongoDB connections are not implemented.
- Ready-post preview reading and basic field mapping were manually verified with one post. Whole-schema validation, publication eligibility, and the full ContentPost model remain to be implemented.
- X publishing and metrics endpoints have not been called.
- The project is not production-ready.
