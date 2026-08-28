# Project context

Last verified: 2026-08-28

## Purpose

This file is the handoff between development chats. It records the stable product goal, the current implementation state, and the next checkpoint. Update it after meaningful changes so the user does not need to repeat earlier decisions.

## User and working style

- The user is a React frontend developer learning Node.js and backend development.
- Explanations should be concise, concrete, and in plain Russian.
- Work one small step at a time and reconnect backend concepts to familiar frontend ideas when helpful.
- The user installs dependencies personally.
- Do not run tests, builds, linters, formatters, or the development server unless explicitly requested.

## Product goal

Build a learning-focused but production-minded application that publishes manually approved Notion content to one Threads account.

```text
User writes or edits content in Notion
                ↓
Status becomes ready
                ↓
Node.js reads, maps, and validates the post
                ↓
MongoDB claims and tracks the publication safely
                ↓
DRY_RUN=false plus explicit human approval
                ↓
Threads publishes the post
                ↓
Post ID, URL, time, and published status return to Notion
                ↓
Later: supported Threads metrics synchronize to Notion
                ↓
Much later: optional AI helps draft and analyze content
```

Notion is the editorial interface and content source. MongoDB is internal technical storage for claims, progress, attempts, identifiers, recovery, and later synchronization state. Fastify is the HTTP entry point for health checks and future callbacks or webhooks; publishing business logic must not live inside route handlers.

## MVP

The first working MVP must:

1. Read a Notion post with status `ready`.
2. Map it to an internal `ContentPost` model.
3. Validate text and publication eligibility.
4. Simulate the workflow by default with `DRY_RUN=true` and no external writes.
5. After explicit approval and with dry-run disabled, publish one text post to Threads.
6. Store a publication record in MongoDB.
7. Write the Threads ID, URL, publication time, and `published` status back to Notion.
8. Prevent intentional duplicate publication of the same Notion page.
9. Run initially as a finite manual CLI command with understandable errors and tests for core business rules.

Outside the MVP: AI generation, automatic AI publication, Notion webhooks, scheduled posts, internal cron loops, queues, microservices, multiple Threads users, a dashboard, and complex deployment.

## Approved decisions

- Node.js 24, TypeScript, strict mode, ES modules, and npm.
- Fastify for HTTP and Zod for runtime validation.
- Structured logs through Fastify/Pino.
- Official Notion JavaScript SDK.
- Native `fetch` for Threads.
- Official MongoDB Node.js driver without Mongoose.
- Vitest, ESLint, and Prettier.
- One codebase with separate HTTP and finite CLI entry points.
- One owner and one Threads account for the MVP.
- Manual execution first; external scheduling later.
- No paid infrastructure without explicit approval.

## Safety and reliability

- `DRY_RUN=true` is the default. Dry-run must not publish to Threads, update Notion, or write a publication record.
- A real publication requires explicit confirmation immediately before the external action.
- Secrets must stay in ignored environment variables and must not appear in source code, client code, logs, or examples.
- Use a unique `notionPageId` and an atomic MongoDB claim to prevent concurrent duplicate publication.
- Persist external identifiers and progress so crashes can be reconciled.
- If Threads may have published but the outcome is ambiguous, never automatically publish again.
- If Threads succeeds and the Notion update fails, retain the Threads result and retry only the Notion update.

## Domain model direction

```ts
type PostStatus = 'draft' | 'ready' | 'published';

interface ContentPost {
  notionPageId: string;
  title: string;
  text: string;
  topic: string | null;
  status: PostStatus;
  threadsPostId: string | null;
  threadsUrl: string | null;
  publishedAt: Date | null;
}
```

Raw Notion and Threads responses stay inside their adapters and are mapped to stable internal types.

## Current implementation state

Verified in the repository on 2026-08-28:

- Project setup exists for Node.js, TypeScript, npm, and ES modules.
- `src/app.ts` builds the Fastify application and registers routes.
- `src/server.ts` loads local environment settings, validates configuration, starts Fastify, logs startup, and handles `SIGINT`/`SIGTERM` shutdown.
- `src/config/env.ts` validates `NODE_ENV`, `LOG_LEVEL`, `HOST`, `PORT`, and `DRY_RUN` with Zod.
- `GET /health` returns `{ "status": "ok" }`; the user manually confirmed it works.
- `GET /posts` is a temporary learning route with three in-memory posts in `draft`, `ready`, and `published` states.
- The posts route is registered and was reviewed as correct for the current exercise.
- The official `@notionhq/client` dependency is installed, but no Notion client or adapter code exists yet.
- Tests exist for environment parsing and the health route. On 2026-08-28, all 5 tests, linting, type checking, the production build, and the formatting check passed.
- `npm audit` reported 0 known vulnerabilities after safe transitive patch updates were recorded in `package-lock.json`.
- README and `docs/architecture.md` describe the MVP and approved architecture.

Local environment note: the latest checks ran successfully with Node.js `v26.5.0`, but the project supports Node 24 LTS (`>=24.1.0 <25`). Switch the terminal to a current Node 24 release and repeat the checks before relying on runtime parity.

Not implemented:

- persistent Posts API
- MongoDB connection and publication repository
- Notion integration or real schema inspection
- Threads/Meta authentication or publishing
- publishing service and idempotency state machine
- analytics, scheduling, AI, or deployment

Environment placeholders for future integrations already exist in `.env.example`; a placeholder does not mean its integration is implemented.

## Concepts already discussed

- Node.js versus browser JavaScript.
- CLI arguments through `process.argv`.
- Files through `node:fs/promises` and paths through `node:path`.
- Node.js can create an HTTP server itself; Fastify is a convenient framework on top.
- `Fastify()` prepares the application; `app.listen()` opens the configured network address and accepts requests.
- `HOST + PORT` identify the server entrance; HTTP method plus route select the operation.
- Environment variables are settings supplied outside source code; Zod validates and converts them.
- `app.ts` assembles the application, `server.ts` controls its lifecycle, and `routes/*.ts` describe endpoints.

Do not assume every concept is fully mastered. Briefly reconnect new code to these ideas when relevant.

## Current checkpoint

The user chose the product track and wants publishing to run first as a finite manual CLI command. Fastify remains in the project for backend learning, health checks, and future HTTP integrations, but route handlers must not own publishing logic.

At the start of the next development task:

1. Inspect the working tree and read this file before changing code.
2. Briefly remind the user that the Notion SDK is installed but not connected yet.
3. Continue Phase 2 with one small step: prepare the Notion connection and inspect the real data-source schema in a read-only way.
4. Keep `DRY_RUN=true`; do not update Notion or call Threads during schema inspection.
5. After the real schema is known, map eligible Notion pages to the internal `ContentPost` model and only later wire that flow into a finite CLI entry point.
