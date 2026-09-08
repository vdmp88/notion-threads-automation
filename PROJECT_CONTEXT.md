# Project context

Last context update: 2026-09-08. Verification dates for code and checks are recorded below.

## Purpose

This file is the handoff between development chats. It records the stable product goal, the current implementation state, and the next checkpoint. Update it after meaningful changes so the user does not need to repeat earlier decisions.

## Local workspace and context ownership

Confirmed with the user on 2026-09-07:

- Work in the existing local project folder: `/Users/iamvdmp/Documents/NixWork/notion-threads-automation`.
- The `PROJECT_CONTEXT.md` in this repository root is the single authoritative context document. Read and update it directly; do not create context copies or replacement projects in temporary folders or chat mirrors.
- If a chat starts elsewhere, explicitly use the project folder above. If it is unavailable, report the access problem instead of working from another snapshot.
- The assistant edits local project files. The user owns all Git operations, including staging, commits, branches, merges, pulls, and pushes. Do not run Git commands unless the user explicitly delegates a specific operation.
- Check existing local file contents before editing, preserve unrelated changes, and verify edits by reading the files without relying on Git commands.

## Publishing target and retained names

Decision on 2026-09-08: the product is **Notion → X (Twitter)**. This replaces the earlier Threads plan; a Threads adapter is not required. See [ADR 004](docs/decisions/004-target-x-twitter.md).

This is a documentation/plan change. Existing source code, secrets, repository identity, and external Notion resources were not renamed or migrated:

- Local folder and npm package remain named `notion-threads-automation`; the package description also retains its historical wording.
- The Notion connection is still `notion-threads-automation` and the database title is still `Threads Posts`. Historical screenshots and successful command output below retain these exact names. Continue using the existing database/data-source IDs and token.
- The temporary learning `GET /posts` still contains a `threadsUrl` field and an example URL. This is legacy mock data, not an active publishing integration or the future domain model.
- New documentation uses `xPostId`, `xUrl`, and planned Notion properties `X Post ID` / `X URL`. Those publication fields do not exist in the current four-column Notion database yet.
- The unused Threads/Meta placeholders were removed from `.env.example`. X authentication settings will be specified when the Phase 3 auth flow is selected; the local `.env` was not changed.

The Notion CLI work and completed text-rule tests remain valid. The pending live empty-text check remains pending; no X account, developer app, API access, cost, or publication has been configured or verified. Before Phase 3, check current official X access/pricing, user-context authentication, and text-length counting rules. Do not carry over the old container flow, permissions, token lifetimes, or text limit.

## User and working style

- The user is a React frontend developer learning Node.js and backend development.
- Explanations should be concise, concrete, and in plain Russian.
- Work one small step at a time and reconnect backend concepts to familiar frontend ideas when helpful.
- The user installs dependencies personally.
- Do not run tests, builds, linters, formatters, or the development server unless explicitly requested.

## Product goal

Build a learning-focused but production-minded Notion → X (Twitter) application that publishes manually approved content to one X account.

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
X publishes the post
                ↓
Post ID, URL, time, and published status return to Notion
                ↓
Later: supported X metrics synchronize to Notion
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
5. After explicit approval and with dry-run disabled, publish one text post to X.
6. Store a publication record in MongoDB.
7. Write the X ID, URL, publication time, and `published` status back to Notion.
8. Prevent intentional duplicate publication of the same Notion page.
9. Run initially as a finite manual CLI command with understandable errors and tests for core business rules.

Outside the MVP: AI generation, automatic AI publication, Notion webhooks, scheduled posts, internal cron loops, queues, microservices, multiple X users, a dashboard, and complex deployment.

## Approved decisions

- Node.js 24, TypeScript, strict mode, ES modules, and npm.
- Fastify for HTTP and Zod for runtime validation.
- Structured logs through Fastify/Pino.
- Official Notion JavaScript SDK.
- Native `fetch` for X.
- Official MongoDB Node.js driver without Mongoose.
- Vitest, ESLint, and Prettier.
- One codebase with separate HTTP and finite CLI entry points.
- One owner and one X account for the MVP.
- Manual execution first; external scheduling later.
- No paid infrastructure or paid X API usage without explicit approval.

## Safety and reliability

- `DRY_RUN=true` is the default. Dry-run must not publish to X, update Notion, or write a publication record.
- A real publication requires explicit confirmation immediately before the external action.
- Secrets must stay in ignored environment variables and must not appear in source code, client code, logs, or examples.
- Use a unique `notionPageId` and an atomic MongoDB claim to prevent concurrent duplicate publication.
- Persist external identifiers and progress so crashes can be reconciled.
- If X may have published but the outcome is ambiguous, never automatically publish again.
- If X succeeds and the Notion update fails, retain the X result and retry only the Notion update.

## Domain model direction

```ts
type PostStatus = 'draft' | 'ready' | 'published';

interface ContentPost {
  notionPageId: string;
  title: string;
  text: string;
  topic: string | null;
  status: PostStatus;
  xPostId: string | null;
  xUrl: string | null;
  publishedAt: Date | null;
}
```

Raw Notion and X responses stay inside their adapters and are mapped to stable internal types.

## Current implementation state

Verified in the repository on 2026-08-28:

- Project setup exists for Node.js, TypeScript, npm, and ES modules.
- `src/app.ts` builds the Fastify application and registers routes.
- `src/server.ts` loads local environment settings, validates configuration, starts Fastify, logs startup, and handles `SIGINT`/`SIGTERM` shutdown.
- `src/config/env.ts` validates `NODE_ENV`, `LOG_LEVEL`, `HOST`, `PORT`, and `DRY_RUN` with Zod.
- `GET /health` returns `{ "status": "ok" }`; the user manually confirmed it works.
- `GET /posts` is a temporary learning route with three in-memory posts in `draft`, `ready`, and `published` states.
- The posts route is registered and was reviewed as correct for the current exercise.
- The official `@notionhq/client` dependency is installed. Notion configuration/client helpers were added on 2026-09-07; see the current checkpoint for the later progress.
- Tests exist for environment parsing and the health route. On 2026-08-28, all 5 tests, linting, type checking, the production build, and the formatting check passed.
- `npm audit` reported 0 known vulnerabilities after safe transitive patch updates were recorded in `package-lock.json`.
- README and `docs/architecture.md` describe the MVP and approved architecture.

Local environment note: the latest checks ran successfully with Node.js `v26.5.0`, but the project supports Node 24 LTS (`>=24.1.0 <25`). Switch the terminal to a current Node 24 release and repeat the checks before relying on runtime parity.

Not implemented:

- persistent Posts API
- MongoDB connection and publication repository
- full ContentPost mapping and publication eligibility validation (read-only schema and ready-post preview CLIs have both been manually verified)
- X authentication or publishing (the previous Threads target was replaced on 2026-09-08)
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

Progress on 2026-09-07:

- The user created the `notion-threads-automation` internal Notion connection using Access token authentication in `Vadym Pakharuk’s Space`. Creation was visible in a screenshot; the user subsequently confirmed completion after instructions to keep only Read content and select No user information. The final capability settings have not been independently checked.
- The user created the `Threads Posts` database. Screenshots show Name (Title), Text (Text), Topic (Select), and Status (Status), with one test row: Name `First text`, Text `Hi there! It’s my first post!`, Topic `general`, Status `draft`.
- After the user supplied the database URL and asked to try it, a one-off read-only check using the installed Notion SDK and the locally supplied token succeeded. Database title: `Threads Posts`. Verified properties: Name (`title`), Text (`rich_text`), Topic (`select`, option `general`), Status (`status`, options `draft`, `ready`, `published`). No posts were queried or changed in this check.
- Database ID: `3d420a4e-cef0-804d-93d1-dbd16e9153af`. Its single data-source ID: `3d420a4e-cef0-805e-9624-000b7e9e6224`. Both were saved in the local `.env`, preserving the token supplied by the user. `DRY_RUN=true` remains the default. Existing `.gitignore` rules exclude `.env`; never display its secrets.
- The diagnostic ran on Node `v26.5.0` with the installed SDK default API version `2025-09-03`. This confirms access and schema, not Node 24 runtime parity or completion of the application adapter. No reusable Notion client/CLI code was added, and no tests/builds were run.

Next small code step completed on 2026-09-07:

- `src/config/notion.ts` exports `parseNotionEnv(input)` and `NotionConfig`. Zod checks a nonempty token and a UUID data-source ID; errors contain field names only. This parser is separate from HTTP configuration.
- `src/integrations/notion.ts` exports `createNotionClient(config)`. It creates the SDK client without making requests, with a 15-second timeout, automatic retries disabled, and raw SDK logging suppressed. Callers must handle errors safely.
- Application code explicitly selects API version `2026-03-11`, matching the architectural baseline and supported by installed SDK 5.26.0 according to official versioning documentation. The earlier live diagnostic used `2025-09-03`; the new helper/version has not been executed yet.
- These functions are not yet called from an entry point. The future CLI will load `.env`, validate settings, create the client, and call a read method. No dependencies were installed, Git commands used, or tests/builds/formatters run for this step.

Following code step on 2026-09-07:

- Added `src/cli/inspect-notion.ts` and `npm run notion:inspect`. The finite CLI loads `.env` from the project root when present, validates Notion settings, creates the client, and prints a schema summary.
- Added `readNotionSchema` in `src/integrations/notion.ts`; raw SDK responses stay inside the integration. The returned summary contains the source ID/title and field names/types/select or status options. It inspects rather than validates the expected post schema.
- Errors produce exit code 1 and omit raw API responses and credentials. The command performs only schema reads, even if DRY_RUN is false; it never starts the HTTP server.
- The user ran `npm run notion:inspect` successfully and shared its output on 2026-09-07. It returned the expected data-source ID, title `Threads Posts`, and all four fields with `draft`, `ready`, `published` status options. This verifies the CLI's read path using the configured API version `2026-03-11`; the user's runtime version was not included in the output. Typechecking and automated tests for the new code remain unrun. The npm upgrade notice was informational, not a command failure.
- The user asked to postpone the detailed code explanation. They subsequently confirmed changing the test post from `draft` to `ready`. No publishing functionality exists yet.

Ready-post preview step on 2026-09-07:

- Added `src/integrations/notion-posts.ts`: `readReadyNotionPosts` queries Status equal to `ready`, follows pagination, and maps full non-archived pages to `ReadyPostPreview` (notionPageId, title, text, nullable topic, status). It checks the four property types on returned rows, concatenates rich-text fragments, and rejects partial results or invalid returned properties with fixed safe error messages.
- Added `src/cli/list-notion-posts.ts` and `npm run notion:posts`. The CLI loads and validates local settings and prints `{ count, posts }`. No matches is a successful empty result. It does not modify Notion, MongoDB, or X, regardless of DRY_RUN.
- This is preview mapping, not full ContentPost or publication validation. Oversized text and whole-schema checks on empty query results remain pending. Empty-text validation was added in the next step below.
- On 2026-09-08 the user shared a successful `npm run notion:posts` result: count 1, notionPageId `3d420a4e-cef0-80fd-a95d-e7f0f390a846`, title `First text`, text `Hi there! It’s my first post!`, topic `general`, status `ready`. This manually verifies the single-post read/mapping path. Empty results, pagination, malformed data, and exclusion of other statuses have not yet been tested. Automated checks remain unrun.

Text validation step on 2026-09-08:

- Added `postTextSchema` in `src/domain/post-text.ts`. Zod rejects empty and whitespace-only strings using a trimmed copy for the check, preserving the original text for valid posts.
- The Notion mapper validates the assembled rich-text string before returning a preview. Failure raises a safe `NotionPostDataError` with the page ID; the existing CLI exits with code 1 and prints no partial preview. It makes no external writes.
- Added five focused cases in `test/post-text.test.ts` for blank inputs and preservation of author formatting. On 2026-09-08 the user ran `npm test -- test/post-text.test.ts` and shared output confirming all five passed. This verifies the isolated text rule. The updated CLI's rejection path against a real empty Notion post and typechecking remain unverified; the successful ready-post run above predates this change.

At the start of the next development task:

1. Inspect local files and read this file before changing code; Git operations belong to the user. Continue toward X (Twitter), even though retained resource names contain threads.
2. Both CLIs were manually verified before the new empty-text rule; all five focused text-rule tests now passed in the user's terminal. Next guide a live check: the user adds a separate empty Text test row with Status ready, runs `npm run notion:posts`, and shares the safe error. Then they change that extra row to draft and rerun to confirm the original valid post is returned. Preserve the original post; do not change Notion yourself without authorization.
3. Continue Phase 2 in small steps with expected-schema validation, remaining content rules, and full ContentPost mapping. Use supported Node 24 for checks and run commands only when requested. The detailed code explanation remains deferred at the user's request.
4. Keep `DRY_RUN=true`; do not update Notion or call X during schema inspection.
5. Extend the existing read-only CLI flow with validated ContentPost mapping before progressing to X. Phase 2 is still in progress; successful preview alone does not complete it.
