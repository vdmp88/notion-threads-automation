# Project context

Last context update: 2026-10-20. Verification dates for code and checks are recorded below.

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

Decision on 2026-10-05: return to **Notion → Threads** after the user declined paid X API usage. X is no longer in scope; [ADR 005](docs/decisions/005-return-to-threads.md) supersedes ADR 004. Do not introduce a multi-platform abstraction.

The target decision was documentation-only; the local field rename was implemented on 2026-10-06. External resources are unchanged:

- Keep the folder/npm package and Notion connection `notion-threads-automation`, database `Threads Posts`, existing database/data-source IDs, and token.
- Current `ContentPost`, mapper, tests, and CLI output use `threadsPostId` and `threadsUrl` as null placeholders. The mock posts route also uses `threadsUrl`. This rename has source review only, not new runtime verification.
- Planned Notion properties are `Threads Post ID` and `Threads URL`; publication properties have not been added to the four-column database.
- The temporary `GET /posts` is still mock data, not a publishing integration.
- Threads/Meta placeholders were previously removed from `.env.example`. Define the required settings during authentication implementation; neither the template nor the local `.env` changed in this documentation step.

Phase 2 remains complete as a read-only Notion adapter. On 2026-10-06 the user confirmed app/tester setup, storing a replacement user token, and a successful Threads profile CLI run. On 2026-10-20 the user confirmed the test publication with a screenshot dated 2026-10-06. Stage 3 is complete for the isolated single-owner adapter; live token refresh remains unverified. Do not transfer X-specific endpoints, PKCE assumptions, or text-counting rules to Threads.

## User and working style

- Latest preference, 2026-10-20: focus on development, defer manual testing to the end of the next implementation milestone, and run automated checks only when explicitly requested again. Do not reuse the earlier end-of-Stage-3 check authorization. Defer the learning walkthrough and questions; do not treat this as demonstrated understanding.
- Testing preference, 2026-10-06: prioritize implementation; defer automated checks to one end-of-Stage-3 batch with permission. Do not expand tests merely for coverage or repeatedly request interim runs. Preserve runtime safety guards.
- Latest preference, 2026-10-06: focus on development through the rest of Stage 3. Defer comprehension questions/exercises until Stage 3 ends. Later questions should address backend mechanisms (request lifecycle, authorization, persistence, concurrency, recovery), not return values or obvious mapping. The user correctly identified the profile mapping but found that question trivial.
- The user is a React/Next.js frontend developer learning Node.js and backend development. On 2026-09-10, they clarified the long-term goal: become a full-stack developer able to independently build backend logic for shops, blogs, learning apps, and simple AI agents.
- The assistant implements all project code for now. The user wants to understand the mechanisms well enough to implement a second project independently.
- Explain new mechanisms in detail, concretely and in plain Russian. Reduce repetition and administrative overhead, not the explanation needed for understanding.
- Keep repository documentation in English. Explain backend mechanisms and architectural choices in Russian in chat. As clarified on 2026-10-05, avoid comprehension questions about obvious exception propagation or console output; focus on how backend components work and why their responsibilities are separated.
- User preference on 2026-09-10: explanation first, then small optional exercises. Offer predictions, error tracing, or a small local change after the relevant concept has been explained; do not make required project implementation homework.
- User decision on 2026-09-08: critical-only tests, representative cases, batched checks, and short result summaries. Reduce token overhead and avoid repeated test/log/documentation round trips.
- Work one small step at a time and reconnect backend concepts to familiar frontend ideas when helpful.
- The user installs dependencies personally.
- Do not run tests, builds, linters, formatters, or the development server unless explicitly requested.
- A feature is not complete as a learning step merely because its code and tests work. Before advancing to the next product phase, explain the feature end to end in plain Russian: entry point, data flow, responsibilities of each file, important backend concepts, failure path, and how the user can inspect the behavior themselves. Allow discussion and optional practice before adding another major abstraction; exercises are not mandatory gates, and the user may explicitly choose to continue.
- Track implementation/verification separately from explanations, user-confirmed understanding or practice, and topics needing review. The broader learning topics in `docs/roadmap.md` are not new MVP requirements.

## Product goal

Build a learning-focused but production-minded Notion → Threads application that publishes manually approved content to one Threads account.

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
- Use a no-paid-service learning path; ask before introducing any paid service.

## Safety and reliability

- `DRY_RUN=true` is the default. Dry-run must not publish to Threads, update Notion, or write a publication record.
- A real publication requires explicit confirmation immediately before the external action.
- Secrets must stay in ignored environment variables and must not appear in source code, client code, logs, or examples.
- Use a unique `notionPageId` and an atomic MongoDB claim to prevent concurrent duplicate publication.
- Persist external identifiers and progress so crashes can be reconciled.
- If Threads may have published but the outcome is ambiguous, never automatically publish again.
- If Threads succeeds and the Notion update fails, retain the Threads result and retry only the Notion update.

## Current domain model

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
- The official `@notionhq/client` dependency is installed. Notion configuration/client helpers were added on 2026-09-07; see the current checkpoint for the later progress.
- Tests exist for environment parsing and the health route. On 2026-08-28, all 5 tests, linting, type checking, the production build, and the formatting check passed.
- `npm audit` reported 0 known vulnerabilities after safe transitive patch updates were recorded in `package-lock.json`.
- README and `docs/architecture.md` describe the MVP and approved architecture.

Local environment note: the latest checks ran successfully with Node.js `v26.5.0`, but the project supports Node 24 LTS (`>=24.1.0 <25`). Switch the terminal to a current Node 24 release and repeat the checks before relying on runtime parity.

Not implemented:

- persistent Posts API
- MongoDB connection and publication repository
- publication metadata loading and remaining publication eligibility validation (ContentPost editorial mapping now exists; see the latest checkpoint for unrun changes)
- custom Threads OAuth callback/short-token exchange (not required for the selected dashboard-owner-token path); refresh is implemented but live-unverified, while isolated publishing is user-confirmed
- ledger-backed Notion publishing service and idempotency state machine
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

Stage 4 implementation and manual end-to-end milestone closed on 2026-10-20:

- The user confirmed that `--sync-only` succeeded after the date-precision fix. The manual path now has evidence for Notion preflight/dry-run, MongoDB connection and persisted publication, Threads publication, Notion result updates, and recovery to `notion_synced` without another post.
- Closure does not claim exhaustive verification: concurrent claims, duplicate-run rejection, interrupted/ambiguous outcomes, Node 24 parity, and the new automated tests have not been exercised in this stage. Automated checks remain deferred until explicitly requested. No checks or external writes were performed for this status update.
- Interrupted claims still require manual reconciliation; no automatic reclaim or exactly-once guarantee exists. Keep DRY_RUN=true. Do not reuse the completed page for a fresh publication.
- Learning is not complete: the end-to-end Stage 3/4 code walkthrough, state transitions, atomic claims, and partial-failure recovery remain to review. Next recommended checkpoint is that walkthrough before adding scheduled execution. Phase 5 has not started and is not authorized by this status question.

### Stage 4 recovery checkpoint (historical)

Stage 4 live publication and date-precision repair on 2026-10-20:

- User successfully ran dry-run and then the approved live publication for page `3fe20a4e-cef0-80d1-9e3b-ea16aeac4859`. User-shared ledger output confirms state `published`, container `18216391969367727`, post `18166064200438556`, and URL `https://www.threads.com/@vd00m_dev/post/DesboauCpAN`. The user confirmed Notion result fields were updated.
- A user-approved read-only Notion request confirmed matching text, post ID, URL, and published status. The failure was exact timestamp comparison: ledger `2026-10-19T23:24:59.033Z` versus Notion `2026-10-19T23:24:00.000+00:00`. Notion had successfully stored the result; readback verification rejected its minute precision before marking the ledger synchronized.
- Fixed both the conflict precheck and final readback check to compare UTC minute buckets. Exact MongoDB timestamps remain unchanged; a different minute still conflicts, and a missing readback date still fails. Added one focused regression test for observed precision, timezone equivalence, next-minute rejection, and timestamp preservation; not run.
- No tests, typecheck, build, lint, formatter, live synchronization, database write, or publication was run for the repair. Next: user runs the existing command with `--sync-only`, confirms PREPARE and SYNC, and shares the result. Do not republish or reset the record. Stage 4 remains open until recovery is confirmed. Earlier setup/verification notes below are historical.

### Earlier Stage 4 implementation checkpoint

Stage 4 integrated CLI and Notion synchronization implemented on 2026-10-20:

- Added `integrations/notion-publication.ts`: read-only schema preflight for the three publication columns; metadata-aware page reads with configured-source membership checks; ready-post narrowing; controlled result updates and readback verification. The existing Stage 2 preview remains unchanged and is never used as the publication input. Publishing text is plain rich text with fewer than 25 spans; complex/truncation-risk inputs fail closed.
- Added `notion_synced`, read-only ledger access, and guarded synchronization completion. Threads URLs in saved records are restricted to HTTPS Threads domains. New `syncNotionPublication` has no publish/container dependency: it handles confirmed published results only, recovers a missing URL with an account check, refuses conflicting Notion content/metadata, and retains published state on failure.
- Added `npm run notion:publish -- --page PAGE_ID [--sync-only]`. Default dry-run reads Notion only; sync-only dry-run additionally reads MongoDB, without index initialization. Live mode requires TTY and separate PREPARE/PUBLISH/PUBLISH/SYNC confirmations. Existing records block fresh publication. Ambiguous or interrupted claims are not automatically resumed, reset, or deleted.
- Added read-only `npm run publication:status -- --page PAGE_ID` for viewing validated saved states and external IDs without Notion/Threads calls, index initialization, or database writes. It distinguishes a missing record from a read failure and warns that missing history is not publication approval. Already synchronized or ambiguous sync-only attempts stop before any index initialization.
- No external schema was changed. User must add `Threads Post ID` (Text), `Threads URL` (URL), and `Published At` (Date) to the existing data source before preview; live sync requires Update content capability. These properties are not confirmed present. Use new content, not the earlier isolated test post. Do not edit content/status during a run; the Notion precheck and PATCH are not an atomic compare-and-swap.
- Added four focused synchronization tests (not executed). No tests, typecheck, builds, lint, formatter, Docker command, Git operation, API request, or external write was performed. Source review only. The previous MongoDB connection success does not validate this workflow. Stage 4 remains open pending manual dry-run/live/recovery verification; automated checks require an explicit request.
- Next checkpoint: user creates the three properties and runs the documented dry-run for one explicit ready page. Obtain immediate approval before any live publication or Notion write. Remaining interrupted-claim reconciliation is manual; no exactly-once guarantee is claimed. Teaching review remains deferred.

### Earlier Stage 4 checkpoints

Manual MongoDB connectivity confirmed by the user on 2026-10-20:

- User-shared output shows `docker compose up -d mongodb` started the local container and `npm run mongodb:inspect` returned `{ "connected": true, "writes": false }`, then exited to the shell. This verifies the local connection/ping/cleanup success path.
- No explicit failure-path output was supplied. Index creation, atomic claims, state transitions, persistence across container recreation, and integrated publication remain unverified. No assistant-run checks or external writes were performed for this update.
- Next implementation remains metadata-aware Notion preflight and controlled result synchronization, followed by integrated CLI wiring. Do not republish the earlier test post or infer complete Stage 4 verification from this connection check.

Stage 4 second implementation slice on 2026-10-20:

- MongoDB 7.7 is now present in the user's package.json; dependency changes were preserved. No installation was performed by the assistant.
- Added runtime-validated publication states `claimed`, `container_created`, `publish_started`, and `published`. Repository reads strip raw MongoDB fields; guarded updates match page ID, claim ID, and expected state. The container ID is persisted before publication intent, and intent before the Threads publish request. Existing records are never automatically released or reclaimed.
- Added `publishNotionPost` service: offline dry-run; account/text preview; separate creation/publication confirmations; content hash and account binding; authoritative reload callback before each Threads write stage; atomic claim; bounded readiness polling; persisted success before optional permalink lookup. Ambiguous publication leaves `publish_started`; failed success persistence reports the known post ID and requires reconciliation rather than republishing.
- This service deliberately has no CLI/live wiring yet. The existing Notion reader returns null metadata placeholders and cannot satisfy its authoritative reload contract. Next: metadata-aware Notion reader/preflight, controlled result updates, and safe synchronization-only recovery/CLI composition. No automatic resume of partial records is implemented.
- Source review only. No tests, typecheck, builds, linters, formatters, Docker commands, database connections, API requests, or external writes were run. Stage 4 remains incomplete; manual checks remain deferred and automated checks require explicit user request.
- Learning: briefly explained write-ahead publication intent. Full walkthrough and exercises remain deferred; no mastery inferred.

### Stage 4 infrastructure slice (historical)

Stage 4 first implementation slice on 2026-10-20:

- The user accepted local MongoDB through Docker and requested Stage 4 development. Added `compose.yaml` with the official Community Server 8.0 image, loopback-only port binding, and a named data volume. This is unauthenticated local development infrastructure, not a deployment configuration. Nothing was started or downloaded.
- Added MongoDB configuration validation, a bounded connection helper with explicit cleanup, and read-only `mongodb:inspect` (ping only, no indexes or records). The HTTP app and existing CLIs remain independent of MongoDB.
- Added the initial claimed-publication model and repository. Initialization requires dryRun=false and awaits a unique `notionPageId` index. Claims normalize UUID spelling, store content hash/account/claim ID/timestamps, and use one insert rather than read-before-write. Duplicate insertion never grants ownership; uncertain insert outcomes stop without publishing or automatic reclaim. There are no state transitions, deletion, expiry, or recovery commands yet.
- Dependency installation belongs to the user: run `npm install mongodb@7`. The driver is not yet declared/installed; package.json only gained the inspect script and package-lock.json was not edited. New MongoDB imports cannot resolve until installation. No test, typecheck, build, lint, formatter, manual check, API request, Git command, or database write was run. Source inspection only.
- Next development slice: persisted state transitions and an integrated publishing service, then controlled Notion metadata synchronization. Keep the publisher disconnected until those safety pieces exist. Existing isolated test posts have no Notion-page ledger entry; do not infer that existing Notion content is unpublished from null placeholders.
- User setup now: install the driver and add the non-secret MongoDB settings from .env.example to their existing .env without replacing it. Database startup/manual verification is deferred to the milestone's end; automated checks require a fresh explicit request.
- Learning: briefly introduced atomic insertion, unique indexes, and config/connection/repository responsibilities. Detailed walkthrough and comprehension questions remain deferred at the user's request.

### Stage 3 closure

Stage 3 closed on 2026-10-20 based on user-confirmed publication:

- The user supplied a screenshot of the agreed test text on `vd00m_dev`, dated 2026-10-06, and confirmed receiving the post. This satisfies the isolated publication exit criterion. The earlier assistant report that publication had not completed was based on incomplete execution evidence and is superseded by this confirmation.
- No new publication, API request, test, typecheck, build, lint, formatter, dependency install, or Git operation was performed for closure. No post ID or permalink was supplied; do not invent them or republish to recover them.
- Live refresh, permalink recovery, and Node 24 runtime parity remain unverified. These limitations are retained rather than presented as passing checks. Historical automated-check results below are unchanged.
- Learning: the Stage 3 runtime walkthrough, adapter/domain boundaries, authorization lifecycle, and recovery mechanisms still need review. The user explicitly chose development first, with no questions now.
- Next: begin Phase 4 with agreement on the local MongoDB execution method, then connection/configuration and a publication repository with a unique Notion-page key and atomic claims. Local Docker is the proposed option, not yet selected or started. The user installs dependencies. Do not connect Notion to live publication before durable duplicate protection exists.
- Manual verification is deferred until the next milestone; automated checks require a fresh explicit request. Keep DRY_RUN=true and obtain immediate explicit permission for each external write.

### Stage 3 implementation verification (historical)

Stage 3 implementation ready for approved live verification on 2026-10-06:

- Added `src/domain/threads-text.ts`: nonempty/well-formed Unicode validation, ordinary code-point counting, and UTF-8 weighting of emoji clusters. Replaces the temporary all-text byte cap. This is a conservative approximation of the documented rules, not proof of exact equivalence to Meta; link-count enforcement remains with Meta before publication.
- Added permalink retrieval after publication. Success/post ID is reported before the lookup so URL failure cannot hide success or trigger republication. Added `threads:status -- --container ID` / `--post ID` for read-only reconciliation. Readiness polling is bounded to 12 reads, five seconds apart, with per-request timeouts; no automatic writes are retried.
- Added long-lived-token refresh adapter and `threads:refresh`. Default dry-run performs no requests or file writes. Live mode requires interactive REFRESH confirmation, reserves a new private `.env.threads-refreshed` file (0600, exclusive creation), then saves returned token and expiry without logging them. The user copies the new value into `.env`; no secret file was actually read or written during development. Failure may leave the reserved output file empty; inspect privately before retrying. Meta requires tokens to be at least 24 hours old and unexpired.
- The selected Stage 3 auth path is the already configured single-owner dashboard token plus manual refresh. Custom OAuth callback and short-token exchange are not prerequisites for this path. No app secret is needed by the implemented commands.
- Verification: user explicitly approved the final batch. `npm test` passed all 36 tests in 7 files. Initial typecheck found an unused `NotionPostDataError` import in the existing Notion test; removed only that unused import and reran typecheck successfully. Tests were not rerun after this import-only fix. Runtime: Node v26.5.0; Node 24 was not found at common Homebrew/nvm locations, and runtime parity is not claimed. No build/lint/formatter, dependency install, Git command, real publication, token refresh, or other external write was performed.
- Learning: questions remain deferred until Stage 3 ends. No new comprehension or mastery inferred from passing checks.
- Remaining exit criterion: one explicitly approved real test post. Ask approval for the exact text/account immediately before execution. Proposed account: vd00m_dev; proposed text: `Тестовая публикация из моего учебного Node.js-приложения. Notion → Threads.` Nothing is approved yet. Keep Stage 3 open until publication succeeds; do not start Phase 4 or silently publish.

### Earlier Stage 3 implementation notes (historical)

Isolated Threads test publication implemented on 2026-10-06 (not run):

- Added `src/integrations/threads-publishing.ts`, `src/services/publish-threads-test.ts`, `src/cli/publish-threads-test.ts`, and `threads:publish-test`. No Notion/MongoDB integration or external writes were performed.
- Offline dry-run is the default and does not need a token or network. Live mode requires DRY_RUN=false and a TTY, previews the profile/text, confirms container creation, explicitly sets auto_publish_text=false, polls FINISHED status, then confirms publication separately. POSTs are never retried; uncertain publication outcomes require manual reconciliation. Container/post IDs are printed; no durable ledger or cross-run duplicate protection is claimed.
- Temporary text validation is nonempty text plus a conservative 500 UTF-8 byte cap, not exact Meta Unicode counting. This accepts short Unicode examples but may reject otherwise valid longer posts. Exact counting, permalink retrieval, refresh, and custom OAuth remain pending.
- Official Meta Postman text-container and status references were reviewed. No tests were added or run, and no builds/typechecks/linters/formatters, app commands, Git commands, dependency installs, or live API calls were performed. Source review only.
- Next: finish Stage 3 gaps and batch checks at its end. A real test post still requires immediate explicit approval of account/text; the target-switch and implementation requests do not authorize publication. Teaching questions stay deferred until Stage 3 ends.

Threads naming cleanup on 2026-10-06:

- Renamed `xPostId` / `xUrl` to `threadsPostId` / `threadsUrl` in ContentPost, the Notion mapper, mapping-test expectations, and the mock posts route. Publication values remain null; this does not read or write publication metadata.
- No external schema, secret, dependency, or persisted data changed. Source inspection only; tests, typechecks, builds, formatters, live reads, and Git commands were not run. Historical verification output below retains the old names.
- Next development step: implement the isolated Threads text-publication path with dry-run and explicit confirmation guards, following documented container readiness and ambiguous-outcome rules. Do not connect automatic Notion publishing before Phase 4. No real publication is authorized. Defer teaching questions until Stage 3 is complete, as requested.

Threads profile read verified from user-shared output on 2026-10-06:

- `npm run threads:inspect` returned `{ userId: "29195458563371287", username: "vd00m_dev" }`. This confirms the local configuration, authenticated request, response validation/mapping, and CLI success path against Meta. It does not verify publishing permissions, token refresh, failure paths, automated tests, typechecking, or Node 24 runtime parity.
- No assistant-run API calls or Git operations. The user also shared successful push output; no repository operation is delegated by that output.
- Next: reinforce the adapter boundary using the actual profile mapping, then continue with the small legacy publication-field rename before publishing work. The user's successful execution is not evidence of architectural mastery. Keep DRY_RUN=true.

Threads profile read implementation on 2026-10-06:

- User setup: the tester profile appeared in the dashboard generator. The user generated a token, then confirmed revoking the exposed token and storing its replacement as `THREADS_ACCESS_TOKEN` locally. Do not reuse chat credentials or print/read `.env` contents for inspection.
- Added `src/config/threads.ts`, `src/integrations/threads.ts`, `src/cli/inspect-threads.ts`, and `npm run threads:inspect`. The parser validates the local token; the adapter performs one Bearer-authenticated GET to `/v1.0/me?fields=id,username`, validates the response, and maps it to `{ userId, username }`. A 15-second timeout, rejected redirects, no automatic retries, and sanitized errors protect this read-only boundary.
- Updated `.env.example` with the token variable and Threads naming. The private `.env` was not read or changed. Added six focused mocked tests; no dependencies installed, Git operations, tests, typechecks, builds, linters, formatters, or live API calls run. Source review only; all new runtime behavior remains unverified.
- Learning: explain the CLI/config/adapter data flow, Node's native fetch, Bearer headers, HTTP failure handling, and external-response mapping. User demonstrated the per-user token distinction; understanding of this implementation is not yet confirmed.
- Next: user can run `npm run threads:inspect` and report the profile or sanitized error. Successful reading does not verify publishing permission. Keep DRY_RUN=true; publishing, refresh, and custom OAuth remain unimplemented. Legacy publication-field renaming remains a separate step.

Phase 3 introductory lesson on 2026-10-06:

- Introduced Meta app registration versus the Threads user profile, app ID/secret versus user access token, and permission scopes. Connected these concepts to future server-side API requests; no authentication code is implemented yet.
- The user correctly explained that another Threads user needs their own token to publish to their own account. This demonstrates the user-token/account distinction, not mastery of the full authorization flow.
- The user confirmed app creation and supplied the Threads use-case settings screen with deliberately substituted credentials. Do not copy screenshot credentials. The screen includes a tester token generator restricted to public Threads profiles.
- Next: check basic/publishing permissions, add the owner's profile as a Threads Tester, accept its invitation, then return to the token generator. Leave callback fields unchanged for now; a custom OAuth callback is a separate implementation step. Tester setup and token generation are not yet confirmed.
- No application code, environment settings, external state, or verification results changed.

Return to Threads approved on 2026-10-05:

- Decision: the user explicitly chose Threads again and requested documentation updates. X integration and billing setup are abandoned.
- Research: read official Meta pages in the browser: [Get started](https://developers.facebook.com/documentation/threads/get-started), [app setup](https://developers.facebook.com/documentation/development/create-an-app/threads-use-case), [overview and limits](https://developers.facebook.com/documentation/threads/overview), and [posts](https://developers.facebook.com/documentation/threads/posts).
- Cost: the reviewed setup contains no required subscription, credits, or per-post charge. Threads is the selected no-paid-API path based on these documents, not an official promise of permanent free access. Account-specific access is still unverified.
- Access: own-account development can use a Threads Tester invitation accepted by that profile. Users without an app role require approved permissions through App Review and a published app. Publishing requires `threads_basic` and `threads_content_publish`.
- Tokens: user access tokens; short-lived tokens last one hour and can be exchanged for long-lived tokens lasting 60 days. Refresh and permission-grant lifetimes need explicit handling; do not assume a permanent token.
- Publication: create a container via `POST /{threads-user-id}/threads`, then publish via `POST /{threads-user-id}/threads_publish`. Documented ordinary text limit: 500 characters; publication quota: 250 posts per rolling 24 hours. Verify Unicode/emoji counting before implementing validation.
- Implementation/verification: documentation only. No code, environment files, external schemas, or accounts changed. No Git commands, tests, builds, typechecks, linters, formatters, app commands, or API publication calls were run. Documentation was reviewed locally.
- Learning: gave a short overview of tester access, permissions, token expiry, and two-step publishing. These mechanisms have not yet been taught through code or demonstrated by the user. Continue reinforcing adapter/domain boundaries.
- Next: explain Meta app identity versus the user's access token and permissions, then guide app/tester setup with the user's participation. Make the legacy field rename a separate small code step before implementing the Threads adapter. Keep DRY_RUN=true; no real publication is authorized by the target switch.

### Superseded X research on 2026-10-05 (historical, not an action plan)

- Official [pricing](https://docs.x.com/x-api/getting-started/pricing) lists prepaid pay-per-use access: ordinary post creation USD 0.015/request; creation with a URL USD 0.200/request. At those rates, 30 creations cost USD 0.45 or USD 6 respectively, excluding other operations. Spending limits are available. Conditional promotional credits are not a permanent free publishing tier. The user's console, eligibility, balance, and any required top-up amount have not been inspected; paid access has not been approved.
- [Getting access](https://docs.x.com/x-api/getting-started/getting-access) requires a developer account and app. App-only Bearer tokens do not authorize posting as a user. OAuth 1.0a owner Access Token/Secret is a supported personal-automation alternative. Recommend OAuth 2.0 Authorization Code with PKCE for this learning project: fine-grained permissions and a reusable authorization/callback/refresh pattern, with more initial setup than owner tokens. Recommendation only; nothing configured or implemented.
- [OAuth 2.0 reference](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) documents user consent, exact callback matching, state, PKCE, and offline.access for refresh tokens. Implementation should use S256, validate state, keep credentials server-side, and persist refresh changes safely. Do not treat offline.access as making an access token permanent; honor expires_in.
- Publication endpoint: [POST /2/tweets](https://docs.x.com/x-api/posts/create-post). Check required permissions against the [authentication mapping](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping) before implementation.
- [Character counting](https://docs.x.com/fundamentals/counting-characters) describes the standard 280 weighted-character limit, URLs counted as 23, and recommends twitter-text. A simple string.length check is insufficient. No dependency was installed or selected version pinned.
- Historical next action (superseded): present pricing and obtain the user's decision on paid X integration before account/billing setup. No X API requests, external writes, code changes, tests, or app commands were performed; only public documentation was browsed and English project status updated. Keep DRY_RUN=true.

Stage 2 closure approved on 2026-10-05:

- Implementation: close Phase 2 as the read-only Notion adapter. Configuration, schema inspection/validation, ready-post queries, pagination, mapping, and nonempty-text validation already satisfy its read-only exit criterion. The user approved moving the unimplemented controlled Notion updates to Phase 4 with publication metadata and persisted results. No application code changes were needed.
- Verification: source review and historical user-shared results only. No tests, builds, typechecks, linters, formatters, live API calls, or Git operations were run for closure. Existing reduced tests remain unrun.
- Learning: explained process/configuration, SDK construction versus requests, dependency passing, schema checks, and pagination. After correction, the user located the first network-dependent operation and correctly identified schema validation before row queries. Adapter/domain boundaries and the architectural reason for passing dependencies remain topics to reinforce; do not infer mastery from simple output questions. These are not gates to Phase 3.
- Documentation: the user reverted the previous closure edits and Russian walkthrough. Do not restore that walkthrough. This approved closure updates only existing English README, roadmap, and context, keeping the scope change explicit.
- Historical next step (superseded by the Threads decision above): research X access and authentication. No paid calls, external writes, or publication are authorized by this phase transition. Keep DRY_RUN=true.

### Earlier checkpoints (historical)

The user chose the product track and wants publishing to run first as a finite manual CLI command. Fastify remains in the project for backend learning, health checks, and future HTTP integrations, but route handlers must not own publishing logic.

Teaching checkpoint added on 2026-09-09, clarified on 2026-09-10:

- The user reported that Stage 2 was implemented faster than it was taught and does not yet have a clear mental model of how the Notion token, CLI commands, SDK client, schema/post readers, mapping, validation, and console output connect.
- Do not start Phase 3 or add more Stage 2 features yet. First walk through the existing Stage 2 flow in small lessons, using frontend analogies where useful. Treat the review as incomplete until the user can follow the data from `.env` through `npm run notion:posts` to the printed `ContentPost` objects and understands the role of each Stage 2 file.
- Learning status on 2026-09-10: Stage 2 review started with a source-grounded overview and the first lesson on `npm run notion:posts`, tsx, the CLI entry point, the Node.js process, loading environment settings, and local configuration validation/errors. Optional predictions follow the explanation; user understanding and exercise answers are still pending. Next, address questions about startup/configuration, then cover the SDK client/request, schema validation, mapping, and success/error output in subsequent small lessons. No application commands or tests were run for this review.
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
2. Phase 2 is closed as a read-only adapter. Controlled Notion writes are explicitly assigned to Phase 4; the three null publication fields are placeholders.
3. Batch relevant checks and ask only for a summary or errors. Lint/build/format remain unverified; do not claim they passed or make them a gate after every small edit.
4. Proceed with the Threads Phase 3 checkpoint above: explain app identity, permissions, and tokens, then guide app/tester setup. Rename legacy publication placeholders in a separate code step. Reinforce adapter/domain boundaries and dependency passing during backend explanations, without quizzes about obvious output. Threads-specific text limits belong to Phase 3; metadata synchronization and duplicate protection belong to Phase 4.
5. Keep DRY_RUN=true. Null metadata is not proof of no prior publication. Do not write to Notion or publish without explicit approval.
