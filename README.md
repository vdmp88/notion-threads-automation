# Notion to Threads Content Automation

A learning-focused, production-minded Node.js application that will publish explicitly approved Notion content to a single Threads account.

> **Current status:** Phases 2–4 are implemented. The user manually verified integrated publication and synchronization-only recovery on 2026-10-20. Stage 4 automated checks, concurrent/duplicate-run scenarios, Node 24 parity, and live token refresh remain unverified. Learning review is pending; scheduled execution has not started.

## Naming and scope

The publishing target is **Threads**, following the user's decision on 2026-10-05 to avoid paid X API usage. [ADR 005](docs/decisions/005-return-to-threads.md) supersedes the earlier X decision.

The local folder/npm package and Notion connection remain `notion-threads-automation`; the database remains `Threads Posts`. Keep the existing IDs and connection. The domain model and CLI output use `threadsPostId`, `threadsUrl`, and `publishedAt` as null placeholders. The former X-named fields were renamed locally on 2026-10-06; no external database migration was needed. The temporary `GET /posts` remains mock data.

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
- Docker with Compose for the local Phase 4 MongoDB service

Use a current security-patched Node 24 release. If npm reports `EBADENGINE` while using Node 26, switch the terminal back to Node 24 rather than weakening the project's supported-runtime rule.

External integration setup:

- Phase 2: a Notion internal connection and the Threads Posts database are configured; read access was verified. Update access will be needed later.
- Phase 3: the user configured app/tester access and manually verified the profile CLI. Isolated publication, status/permalink reads, and long-lived-token refresh are implemented. A real publication still requires explicit approval. Owner-token setup uses Meta's dashboard; a custom multi-user OAuth callback is not required for this path.
- Phase 4: local MongoDB through Docker Compose; connectivity is user-verified. Integrated publication and synchronization are implemented but not yet manually verified.
- Deployment: a separately approved free or low-cost MongoDB deployment

The user wants a no-paid-service learning path. The reviewed Threads setup documents no subscription or per-post charge; this is not a guarantee of permanent pricing. Ask before introducing any paid service.

## Environment variables

The server runs with safe defaults without a local `.env`. Copy `.env.example` to `.env` when you need to override local settings. Never commit `.env`.

`DRY_RUN` defaults to `true`. In dry-run mode, publishing is simulated and the application must not write to Threads, Notion, or the publication ledger.

Notion tokens and the Threads credentials required by the selected authentication flow are server-only values. They must never appear in client-side code or logs.

`THREADS_ACCESS_TOKEN` is required for profile reads and live test publication, but not for an offline publication dry-run. It is a user access token, not the app secret. The local `.env` is user-managed; never paste tokens into chat.

## Development commands

### Stage 4 setup (in progress)

Install the official MongoDB driver yourself from the project root:

```bash
npm install mongodb@7
```

This updates package.json and package-lock.json. The current package.json already includes MongoDB 7.7; do not repeat installation if your local dependencies are up to date. Keep Node 24 active. Add these settings to your existing private `.env` without replacing its Notion/Threads settings:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=notion_threads_automation
```

Keep `DRY_RUN=true`. When manual verification is requested at the end of the milestone, start Docker and run:

```bash
docker compose up -d mongodb
npm run mongodb:inspect
```

The first command downloads the image if needed and starts the local database. The inspect command only connects, pings, and closes its connection pool; it does not create indexes, claims, or posts. The user confirmed this connection check on 2026-10-20; it does not verify publication persistence or duplicate protection.

`compose.yaml` binds MongoDB only to `127.0.0.1:27017` and persists data in the `mongodb_data` named volume. Authentication is disabled for this isolated local setup: never expose it publicly or use this configuration for deployment. Local processes can access it. `docker compose stop mongodb` stops the service without deleting data. Do not remove its volume (`down -v`, volume deletion, or pruning): losing the ledger also loses duplicate protection. Moving to Atlas will require transferring publication history, not just changing the URI.

The repository initializes a unique Notion-page index before permitting atomic claims. It persists guarded transitions through `claimed`, `container_created`, `publish_started`, `published`, and `notion_synced`. It rejects dry-run initialization, does not release/reclaim records, and stops on ambiguous database errors. The integrated CLI uses a separate metadata-aware reader; it never publishes from the Stage 2 reader's null placeholders.

### Integrated Notion publication (manually verified happy path and sync recovery)

In the existing Notion data source, the following properties are required in addition to the four editorial properties:

| Exact name | Notion property type |
| --- | --- |
| Threads Post ID | Text |
| Threads URL | URL |
| Published At | Date |

No external properties have been created by the assistant. Schema preflight only reads and stops if properties are missing or have the wrong type. The Notion connection needs Read content and, for live synchronization, Update content capability. Never clear publication metadata to force another run. Use genuinely new content for a new publication, not the earlier isolated test post.

Preview one explicit page (replace PAGE_ID with its Notion page ID, not its database/data-source ID):

```bash
DRY_RUN=true npm run notion:publish -- --page PAGE_ID
```

This reads and validates the configured source schema and page, including real publication metadata and source membership. It validates readiness and text, then prints a preview. It does not connect to MongoDB, call Threads, initialize indexes, or write anywhere. It therefore does not claim that the ledger is clear. Text-only publishing currently rejects mentions/equations and properties with 25 or more rich-text spans rather than risking truncated content. Do not edit a page while a live operation is running: Notion offers no cross-system transaction with Threads or MongoDB.

Only after manual review and explicit approval, live mode uses the same command with `DRY_RUN=false`. It requires a terminal and separate confirmations: `PREPARE` for index initialization, `PUBLISH` before container creation, `PUBLISH` before public publication, and `SYNC` before writing the saved result to Notion. The exact account and text are previewed. MongoDB is closed when the command finishes. Existing ledger entries block new publication even if Notion still says ready.

If Threads succeeded but the link lookup or Notion update failed, preview recovery:

```bash
DRY_RUN=true npm run notion:publish -- --page PAGE_ID --sync-only
```

This reads Notion and MongoDB without writes. Live `--sync-only` requires explicit confirmation and can recover the URL, write only Threads Post ID / Threads URL / Published At / Status, verify the result, and mark `notion_synced`. It cannot create or publish a Threads container. Conflicting Notion content/metadata stops synchronization rather than overwriting editorial changes. If the PATCH response was lost, repeating synchronization is safe for matching saved metadata. An already synchronized record is a no-op.

Notion date readback was observed to discard seconds and milliseconds. Synchronization compares Published At using UTC minute buckets, while MongoDB retains the exact timestamp. Different minutes still conflict; this is not a rolling 60-second tolerance.

`claimed`, `container_created`, and `publish_started` records require manual reconciliation; the current CLI never resumes or deletes them. In particular, `publish_started` may already represent a public post. Inspect the saved container/profile and do not retry publication. Loss of the ledger is not recoverable merely by rerunning this command.

Inspect a page's saved state without Notion/Threads requests or database writes:

```bash
npm run publication:status -- --page PAGE_ID
```

This needs only MongoDB configuration, reads the validated record, and closes the connection. It does not initialize indexes and works regardless of DRY_RUN. A missing record is not proof that an isolated/manual post was never published. A database error is not treated as a missing record. For a saved container, the existing `threads:status -- --container CONTAINER_ID` performs a separate read-only API check. Do not clear uncertain records to bypass duplicate protection.

### Existing commands

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

This command first reads and validates the data-source schema, then reads all result pages and prints `{ count, posts }` with each post's Notion page ID, title, text, topic, status, and reserved publication fields (`threadsPostId`, `threadsUrl`, `publishedAt`). The reader now returns `ReadyContentPost`, the ready-status form of the shared `ContentPost` model. Publication fields currently always equal `null`: they are not read from Notion or MongoDB, and must not be used as proof that a post was never published. It requires exact property names/types: `Name` (`title`), `Text` (`rich_text`), `Topic` (`select`), and `Status` (`status`), including the exact status options `draft`, `ready`, and `published`. Additional properties and options are allowed. Invalid schema stops the command with a clear error before querying posts, even if there would be no matching posts. With a valid schema, no matching posts produces `{ "count": 0, "posts": [] }`.

It also checks the four property types on returned posts and fails on incomplete entries rather than presenting them as valid posts. A ready post with empty or whitespace-only Text stops the command with exit code 1 and an error containing the Notion page ID; no partial preview is printed. Nonempty text keeps its original spacing and line breaks. The command makes no external writes, regardless of `DRY_RUN`. Preview output is not publication approval: Threads-specific length rules, loading publication metadata, and duplicate protection are still pending. A repeated pagination cursor stops the command instead of looping indefinitely. The Notion read path has been manually verified; current verification details are recorded in PROJECT_CONTEXT.md.

Inspect the Threads profile associated with the local user token:

```bash
npm run threads:inspect
```

This finite CLI loads local environment settings, validates `THREADS_ACCESS_TOKEN`, and requests `GET https://graph.threads.net/v1.0/me?fields=id,username` using a Bearer authorization header. It prints only `{ userId, username }`. It has a 15-second timeout, rejects redirects, and makes no automatic retries. Failures set exit code 1 without printing credentials or raw remote errors. It never publishes, creates containers, writes to Notion/MongoDB, or starts Fastify, regardless of `DRY_RUN`. A successful read confirms profile access, not publishing permissions or token refresh. The implementation follows [Meta's official profile request](https://www.postman.com/meta/threads/request/k46c8l0/get-app-scoped-user-s-profile-information).

Preview an isolated text publication without network requests or writes:

```bash
DRY_RUN=true npm run threads:publish-test -- --text "Hello from my learning project!"
```

This command does not read Notion or use MongoDB. It rejects blank or ill-formed Unicode text. The local 500-unit preflight counts ordinary Unicode code points and weights emoji clusters by their UTF-8 byte length, following Meta's documented distinction. Cyrillic letters count as one, unlike the earlier temporary byte cap. Combining marks and ambiguous emoji/text symbols may be counted conservatively; this is not a claim of exact parity with Meta's private algorithm. Meta remains the final validator, including its limit of five unique links. Text is passed verbatim and appears in the preview and shell history; do not supply secrets.

Live mode requires `DRY_RUN=false`, a user token, and an interactive terminal. The command reads the target profile, previews the account/text, and requires typing `PUBLISH` before creating a container. It explicitly disables automatic text publication, polls status up to twelve times with five-second intervals, and requires a second `PUBLISH` confirmation before publishing a `FINISHED` container. Every request has a 15-second timeout. It prints the container ID before publication, the post ID on success, and then requests its permalink. A failed permalink lookup does not turn an already successful publication into a failed one. It does not update Notion or persist a ledger.

Do not enable live mode until an actual post is explicitly approved. There are no automatic POST retries. A failed publish response is treated as uncertain; **do not rerun** until the profile/container is reconciled. Process interruption also requires manual inspection: this isolated command has no cross-run duplicate protection. Production Notion publication remains blocked until Phase 4.

Read a known container's status or recover the URL of an already published post (read-only):

```bash
npm run threads:status -- --container CONTAINER_ID
npm run threads:status -- --post POST_ID
```

Replace the placeholder with the numeric ID printed by the publication command. `PUBLISHED` means do not republish. A status read is diagnostic, not automatic permission to restart publication. If no ID was received, inspect the target profile manually.

Refresh a dashboard-generated long-lived user token:

```bash
DRY_RUN=true npm run threads:refresh
```

The dry-run above makes no request or file write. Live refresh requires `DRY_RUN=false`, a TTY, and typing `REFRESH` immediately before the request. It creates `.env.threads-refreshed` exclusively with owner-only permissions (0600); an existing file stops the command before any request. On success it saves the new token and expiry there without printing the token. Copy the token into your local `.env` yourself; the command never overwrites it. The output file matches the existing `.env.*` ignore rule. Shell-level environment values can override `.env`, so remove an outdated exported token before subsequent commands. If a request/save fails, review the private output file (which may be empty) before moving it aside; do not paste its contents into chat.

Refresh requires an unexpired long-lived token at least 24 hours old. Use the returned expiry (normally approximately 60 days); an expired/revoked token requires authorization again through Meta. Permission grants have their own lifecycle; refresh does not guarantee perpetual authorization. Refresh is manual, not automatically triggered by publishing. The single-owner dashboard flow is sufficient for Stage 3; a custom OAuth callback and short-token exchange are future work only if that flow is needed. [Meta token lifecycle](https://developers.facebook.com/documentation/threads/get-started/long-lived-tokens).

References: [Meta text-container request](https://www.postman.com/meta/threads/request/jkuogpa/1-1-create-text-container) and [container states](https://www.postman.com/meta/threads/request/m47wqlq/check-container-s-publishing-status).

Use a small critical-path test suite. Current preference: implementation first, manual verification at the end of the implementation milestone, and automated checks only on explicit request. Earlier check authorization does not carry forward. Share only a pass/fail summary or the relevant error. Run checks only when requested:

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
- Phase 2: read-only Notion schema inspection and mapping — complete
- Phase 3: Threads authentication and an explicitly approved test post — complete
- Phase 4: idempotent publishing workflow backed by MongoDB — implemented; manual publication/sync recovery verified
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

- Isolated and integrated text publishing, Notion updates, and synchronization-only recovery are user-confirmed. Concurrent and duplicate-run scenarios remain unverified.
- `GET /posts` returns temporary in-memory learning data and is not a production content source.
- The read-only Notion schema, Threads profile, and MongoDB connection CLIs have recorded manual verification. Publication state persisted in MongoDB during the user-run live workflow; interruption/concurrency scenarios remain unverified.
- The metadata-aware reader uses the three publication properties now configured by the user. The older notion:posts preview still returns null placeholders. See PROJECT_CONTEXT.md for current verification status.
- Live token refresh and permalink recovery remain unverified. Metrics integration is not implemented.
- The project is not production-ready.
