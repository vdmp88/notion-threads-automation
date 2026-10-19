# Notion to Threads Content Automation

A learning-focused, production-minded Node.js application that will publish explicitly approved Notion content to a single Threads account.

> **Current status:** Phases 2 and 3 are complete: read-only Notion access and the isolated Threads adapter. On 2026-10-20 the user confirmed the test post with a screenshot dated 2026-10-06. Historical checks passed 36 tests and typechecking on Node 26.5.0; Node 24 parity and live token refresh remain unverified. The integrated Notion workflow and durable duplicate protection are Phase 4 work.

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
- Docker (installed but not used in the current phase)

Use a current security-patched Node 24 release. If npm reports `EBADENGINE` while using Node 26, switch the terminal back to Node 24 rather than weakening the project's supported-runtime rule.

External integration setup:

- Phase 2: a Notion internal connection and the Threads Posts database are configured; read access was verified. Update access will be needed later.
- Phase 3: the user configured app/tester access and manually verified the profile CLI. Isolated publication, status/permalink reads, and long-lived-token refresh are implemented. A real publication still requires explicit approval. Owner-token setup uses Meta's dashboard; a custom multi-user OAuth callback is not required for this path.
- Phase 4: MongoDB, with the local execution method confirmed before implementation
- Deployment: a separately approved free or low-cost MongoDB deployment

The user wants a no-paid-service learning path. The reviewed Threads setup documents no subscription or per-post charge; this is not a guarantee of permanent pricing. Ask before introducing any paid service.

## Environment variables

The server runs with safe defaults without a local `.env`. Copy `.env.example` to `.env` when you need to override local settings. Never commit `.env`.

`DRY_RUN` defaults to `true`. In dry-run mode, publishing is simulated and the application must not write to Threads, Notion, or the publication ledger.

Notion tokens and the Threads credentials required by the selected authentication flow are server-only values. They must never appear in client-side code or logs.

`THREADS_ACCESS_TOKEN` is required for profile reads and live test publication, but not for an offline publication dry-run. It is a user access token, not the app secret. The local `.env` is user-managed; never paste tokens into chat.

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

- The health route and application foundation exist. Isolated text publishing is user-confirmed; integrated Notion publishing is not implemented.
- `GET /posts` returns temporary in-memory learning data and is not a production content source.
- The read-only Notion schema and Threads profile CLIs have recorded manual verification. MongoDB is not connected.
- The Notion read/model path has been manually verified. Publication metadata loading and remaining publication eligibility rules are not implemented. See PROJECT_CONTEXT.md for current verification status.
- Live token refresh and permalink recovery remain unverified. Metrics integration is not implemented.
- The project is not production-ready.
