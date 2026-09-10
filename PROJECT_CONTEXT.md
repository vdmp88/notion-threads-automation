# Project context

Last context update: 2026-09-10. Verification dates for code and checks are recorded below.

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

The Notion CLI work and completed text-rule tests remain valid. The user has now verified live empty-text rejection and the subsequent successful valid-post read (see the checkpoint below). No X account, developer app, API access, cost, or publication has been configured or verified. Before Phase 3, check current official X access/pricing, user-context authentication, and text-length counting rules. Do not carry over the old container flow, permissions, token lifetimes, or text limit.

## User and working style

- The user is a React/Next.js frontend developer learning Node.js and backend development. On 2026-09-10, they clarified the long-term goal: become a full-stack developer able to independently build backend logic for shops, blogs, learning apps, and simple AI agents.
- The assistant implements all project code for now. The user wants to understand the mechanisms well enough to implement a second project independently.
- Explain new mechanisms in detail, concretely and in plain Russian. Reduce repetition and administrative overhead, not the explanation needed for understanding.
- User preference on 2026-09-10: explanation first, then small optional exercises. Offer predictions, error tracing, or a small local change after the relevant concept has been explained; do not make required project implementation homework.
- User decision on 2026-09-08: critical-only tests, representative cases, batched checks, and short result summaries. Reduce token overhead and avoid repeated test/log/documentation round trips.
- Work one small step at a time and reconnect backend concepts to familiar frontend ideas when helpful.
- The user installs dependencies personally.
- Do not run tests, builds, linters, formatters, or the development server unless explicitly requested.
- A feature is not complete as a learning step merely because its code and tests work. Before advancing to the next product phase, explain the feature end to end in plain Russian: entry point, data flow, responsibilities of each file, important backend concepts, failure path, and how the user can inspect the behavior themselves. Allow discussion and optional practice before adding another major abstraction; exercises are not mandatory gates, and the user may explicitly choose to continue.
- Track implementation/verification separately from explanations, user-confirmed understanding or practice, and topics needing review. The broader learning topics in `docs/roadmap.md` are not new MVP requirements.

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
- publication metadata loading and remaining publication eligibility validation (ContentPost editorial mapping now exists; see the latest checkpoint for unrun changes)
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

Teaching checkpoint added on 2026-09-09, clarified on 2026-09-10:

- The user reported that Stage 2 was implemented faster than it was taught and does not yet have a clear mental model of how the Notion token, CLI commands, SDK client, schema/post readers, mapping, validation, and console output connect.
- Do not start Phase 3 or add more Stage 2 features yet. First walk through the existing Stage 2 flow in small lessons, using frontend analogies where useful. Treat the review as incomplete until the user can follow the data from `.env` through `npm run notion:posts` to the printed `ContentPost` objects and understands the role of each Stage 2 file.
- Learning status: the Stage 2 explanation and practice remain pending. Start with how `npm run notion:posts` launches the CLI/Node.js process and how environment configuration reaches the program; inspect the relevant source before teaching it. Then cover the SDK client/request, schema validation, mapping, and the success/error output in subsequent small lessons.
- On 2026-09-10, updated AGENTS.md and the learning roadmap to reflect assistant-owned implementation, detailed explanation before optional practice, and the broader full-stack goal. No application code or verification status changed in this documentation step.

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
- Added five focused cases in `test/post-text.test.ts` for blank inputs and preservation of author formatting. On 2026-09-08 the user ran `npm test -- test/post-text.test.ts` and shared output confirming all five passed. This verifies the isolated text rule. The original successful ready-post run above predates this change; subsequent live checks are recorded below. Typechecking remains unverified for this work.

Live text-validation checks confirmed by user output on 2026-09-08:

- With a separate empty `ready` test row, `npm run notion:posts` printed `Ready post 3d520a4e-cef0-8036-9a4c-c2cfeaf9c8e0: Text must not be empty or whitespace-only.` This confirms the real Notion rejection path; the shell exit code was not included in the shared output.
- After instructions to move that test row to `draft` and rerun, the user shared a successful result with `count: 1` and only the original `First text` post (`3d420a4e-cef0-80fd-a95d-e7f0f390a846`, text `Hi there! It’s my first post!`, topic `general`, status `ready`). This confirms the valid read path after adding validation and is consistent with excluding the draft test row.
- Do not repeat these checks by default. Empty result sets, pagination, other malformed properties, and full schema validation remain unverified. The assistant did not run commands against Notion or change external data for these checks.

Expected-schema validation step added on 2026-09-08 (focused tests now passed):

- Added `src/integrations/notion-schema.ts`: `validateNotionPostSchema` checks exact Name/title, Text/rich_text, Topic/select, and Status/status properties, plus `draft`, `ready`, and `published` status options. Extra columns/options are allowed; Topic has no required option value. Failures use `NotionSchemaError` with fixed expected field/type/option names rather than raw API payloads.
- `readReadyNotionPosts` now reads schema once and validates it before the first page query, so an invalid source cannot silently appear to be a valid empty result. Existing per-page and text checks remain. `notion:posts` displays safe schema errors and sets exit code 1. `notion:inspect` remains a diagnostic schema summary.
- Added 17 cases in `test/notion-schema.test.ts`: valid/extended schemas, each missing or incorrectly typed property, renamed property, each missing or differently cased required status, valid empty query, invalid schema preventing the query, and schema-read failure preventing the query. The workflow cases mock the schema reader and SDK query, with network requests disabled; they do not verify real SDK response mapping or the CLI process itself.
- Source and documentation were reviewed by reading files only. No tests, typecheck, formatter, build, dependency installation, Git command, or external API call was run for this step. Current Notion resources and secrets are unchanged.

Verification update from user-shared terminal output on 2026-09-08:

- `npm test -- test/notion-schema.test.ts` passed all 17 tests (one test file).
- The user also ran `npm run typecheck`; the shared `tsc --noEmit` output contains no diagnostics. The shell exit code and returned prompt were not included.
- The user then ran the updated `npm run notion:posts` against the unchanged table and shared `count: 1` with the original `First text` post (`3d420a4e-cef0-80fd-a95d-e7f0f390a846`, text `Hi there! It’s my first post!`, topic `general`, status `ready`). This verifies the new schema preflight and successful read path on the real source. It does not establish full-suite, lint, build, formatting, or Node 24 runtime verification.

ContentPost and mapping-test step on 2026-09-08 (not yet run):

- Added `src/domain/content-post.ts` with `PostStatus`, `ContentPost`, and `ReadyContentPost` (status narrowed to ready). The Notion reader now returns ReadyContentPost instead of its integration-local ReadyPostPreview type.
- Existing editorial fields are mapped as before. Added output keys `xPostId`, `xUrl`, and `publishedAt` always equal null for now: these values are not loaded from Notion/MongoDB and do not establish absence of a past publication. No external columns were added. Reading publication metadata and ledger-backed duplicate checks must be implemented before enabling publication.
- Added repeated-pagination-cursor detection to stop a malformed pagination cycle with a safe NotionPostDataError.
- Added 29 cases in `test/notion-posts.test.ts`: domain output and non-mutation, rich-text fragment preservation, nullable Topic, missing/wrong property types, non-ready statuses, empty text, empty results, archive flags, partial pages, multiple query pages, empty intermediate pages, incomplete responses, missing/repeated cursors, and later-query failure without partial return. Schema reads and SDK queries are mocked and network is disabled.
- No tests, typecheck, build, lint, formatter, dependency installation, external requests, or Git operations were run for this step. Earlier passing output does not verify these new changes.
- The user wants to continue Stage 2 first, then go through a detailed explanation of what was built and how it works. Preserve that teaching checkpoint; do not automatically advance into X setup before the agreed review.

Full-suite verification from user-shared output on 2026-09-08:

- `npm test` passed all 56 tests across 5 files: post-text 5, env 4, notion-schema 17, notion-posts 29, and health 1. This includes the new ContentPost and pagination checks.
- The user also ran `npm run typecheck`; the shared `tsc --noEmit` output contains no diagnostics. Runtime version and shell exit code were not shown.
- The user verified the new output against the real Notion table: count 1, the original First text post, and null xPostId, xUrl, and publishedAt. Lint, build, and formatting were not included in this verification.

Testing-policy update on 2026-09-08:

- At the user's request, reduced 56 tests to 23: env 4, health 1, post-text 2, notion-schema 5, notion-posts 11. Removed repetitive and secondary cases; kept input/schema rejection, the schema gate, mapping, empty results, non-ready/trashed/partial pages, pagination and incomplete-result safety. Production code and guards are unchanged. Coverage is intentionally narrower; removed variants are not hidden inside loops.
- The 56-test pass above is historical. The reduced suite has not been executed. Do not demand an immediate full verification cycle solely for this cleanup; batch a relevant check at the next milestone.

At the start of the next development task:

1. Use this local repository only; Git and command execution remain user-controlled.
2. The read-only Notion schema and ContentPost path is implemented and manually verified, including the three null publication fields. Review Stage 2 exit criteria without adding exhaustive tests or repeating prior live checks.
3. Batch relevant checks and ask only for a summary or errors. Lint/build/format remain unverified; do not claim they passed or make them a gate after every small edit.
4. Before X implementation, give the detailed Stage 2 explanation the user requested. X-specific text limits belong to Phase 3; metadata synchronization and duplicate protection belong to the publishing workflow.
5. Keep DRY_RUN=true. Null metadata is not proof of no prior publication. Do not write to Notion or publish without explicit approval.
