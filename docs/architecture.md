# Architecture

Status: MVP design recorded on 2026-07-28; publishing target restored to Threads on 2026-10-05. See [ADR 005](decisions/005-return-to-threads.md).

The product has one target, Threads. Current Notion reading and validation remain in scope. Legacy publication fields were renamed to Threads names locally on 2026-10-06; external resources are unchanged. Single-owner token-based profile reading is verified; isolated publication was confirmed by the user on 2026-10-20. Live refresh remains unverified. Integrated Notion publication still requires the Phase 4 ledger.

## Goals

- Publish only manually approved Notion content with status `ready`.
- Default to a no-write dry run.
- Never intentionally publish the same Notion page twice.
- Preserve enough state to recover when Threads succeeds but a later operation fails.
- Keep external API shapes at adapter boundaries rather than spreading them through business logic.
- Start with one understandable Node.js codebase and direct API calls.

## Non-goals for the MVP

- Notion webhooks
- scheduled posts or an internal cron loop
- queues or microservices
- multiple Threads users
- AI-generated content
- automatic publication of AI output
- a dashboard

## System context

```text
Notion data source
        |
        | manual CLI query; polling later
        v
Publishing workflow
  1. Map Notion page to ContentPost
  2. Validate schema and text
  3. Atomically claim publication in MongoDB
        |
        | DRY_RUN=false plus explicit approval
        v
Threads API
  1. Create a text container (POST /{user-id}/threads)
  2. Publish the container (POST /{user-id}/threads_publish)
  3. Receive the published post ID
        |
        v
MongoDB publication record
  - Threads post ID
  - publication state
  - sanitized errors and retry information
        |
        | safe, repeatable update
        v
Notion page
  - Threads post ID and URL
  - publication date
  - Status = published

Later:

External scheduler
        |
        v
Analytics command
        |
        | Threads post metrics, where access permits
        v
Notion metric properties
```

## Main components

### Fastify HTTP application

Provides the health check in Phase 1. OAuth callback and webhook routes are added only when needed. It owns HTTP-specific concerns such as request parsing and centralized error responses.

### CLI commands

The MVP publishing workflow runs as a manual, finite CLI command. Analytics later becomes a second command. A job should terminate with a meaningful exit code rather than requiring a permanently running server.

### Notion adapter

Uses the official Notion SDK. It retrieves the current data-source schema, queries eligible pages, maps Notion properties to domain values, and performs controlled page updates. Raw Notion objects do not leave this boundary.

### Threads adapter

Uses native `fetch` with an abort timeout and a Threads user access token. Create a text container through `POST /{threads-user-id}/threads`, then publish it through `POST /{threads-user-id}/threads_publish`. Map the result into internal types, normalize errors, and protect credentials. Container creation is not publication. Follow documented container readiness requirements before publishing. [Threads posts reference](https://developers.facebook.com/documentation/threads/posts).

### Publication service

Contains the business rules for eligibility, validation, dry-run behavior, state transitions, and recovery. Tests can supply mock Notion, Threads, and publication-repository implementations.

### MongoDB publication repository

Uses the official MongoDB Node.js driver. It creates unique indexes, atomically claims a Notion page, and persists publication progress. Mongoose is intentionally omitted to avoid introducing an ODM before one provides a demonstrated benefit.

## Internal domain model

The current shared internal model is defined in `src/domain/content-post.ts`. Its publication placeholders were renamed on 2026-10-06; CLI output now uses the same Threads field names:

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

This model is the backend equivalent of converting an API response into stable frontend view-model props. Tests and business rules depend on our representation, not on every field returned by Notion.

## Notion data model

The existing database is still titled `Threads Posts`. Its four current fields have been inspected: Name, Text, Topic, and Status. The table below distinguishes those fields from proposed publication fields; this document does not claim the latter were created. The ready-post reader now validates those exact field names/types and the status options `draft`, `ready`, and `published` before querying pages. Extra properties/options are allowed. The user shared passing output for all 17 focused schema tests on 2026-09-08. The user also verified the updated preflight against the real table and retrieved the original ready post. The inspection CLI remains diagnostic and does not enforce this schema.

| Property       | Notion UI type        | State / purpose                                     |
| -------------- | --------------------- | --------------------------------------------------- |
| `Name`         | Title                 | Exists; internal post title                         |
| `Text`         | Text (API: rich_text) | Exists; text intended for Threads                         |
| `Topic`        | Select                | Exists; topic grouping                              |
| `Status`       | Status                | Exists; `draft`, `ready`, `published`               |
| `Threads Post ID`    | Text                  | Planned; published Threads identifier, stored as a string |
| `Threads URL`        | URL                   | Planned; public post link                           |
| `Published At` | Date                  | Planned; publication time                           |
| `Sync Status`  | Select                | Proposed; synchronization progress                  |
| `Last Error`   | Text                  | Proposed; bounded, sanitized error                  |
| `Retry Count`  | Number                | Proposed; safe retry attempts                       |

Analytics fields and `Metrics Updated At` are postponed to Phase 6; select only metrics actually available with the user's Threads access. Do not assume metric names, permissions, or availability carry over from the old target. `Scheduled At` is postponed until scheduling is designed. The CLI now returns `ReadyContentPost` (ContentPost with status narrowed to ready). The four editorial properties are mapped, while `threadsPostId`, `threadsUrl`, and `publishedAt` are reserved null values: publication metadata is not loaded yet, even if similarly named extra Notion columns exist. Null must not be treated as evidence of no earlier publication. Publication metadata integration and the MongoDB duplicate check remain prerequisites before enabling a publisher. The user shared a passing full-suite run (56 tests, including all 29 mapping/query cases). Before the rename, the user verified output against the real Notion table: count 1, the original First text post, and null xPostId, xUrl, and publishedAt.

## Publication ledger

The `publications` collection will contain one document per Notion page. Its precise Zod and MongoDB schema will be introduced in Phase 4. Expected fields include:

- `notionPageId` with a unique index
- `contentHash` for detecting content changes during a run
- `state`
- `threadsContainerId` for container-stage recovery
- `threadsPostId`
- `threadsUrl`
- `publishedAt`
- `attemptCount`
- bounded and sanitized `lastError`
- `createdAt` and `updatedAt`

The implemented Stage 4 state sequence is below. Persist `publish_started` before sending the Threads publish-container request; persist the container ID before that stage. Each transition matches the claim owner and expected previous state, following [MongoDB's conditional atomic-update guidance](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).

```text
claimed
   |
   v
container_created
   |
   v
publish_started
   |
   v
published
   |
   v
notion_synced
```

Terminal or review states such as `validation_failed`, `failed`, and `needs_review` will be defined when their retry rules are implemented.

Current conservative behavior: every existing record blocks a fresh publication. Interrupted or cancelled claims are retained, including before publication; no automatic resume/reclaim exists yet. `publish_started` means publication may have happened and must never trigger automatic resend. A confirmed Threads post ID is reported before persistence; if persistence fails, recovery must reconcile that ID with the saved intent. The integrated CLI uses a separate metadata-aware Notion reader. `--sync-only` handles confirmed `published` results without any Threads publication path, then marks `notion_synced` after readback verification.

The write adapter changes only the three publication properties and Status through [Notion's page-update endpoint](https://developers.notion.com/reference/patch-page). It rejects content hashes or existing metadata that conflict with the saved result. This precheck is not atomic with Notion's PATCH; users must not edit the page during a run. An ambiguous PATCH can be retried only as synchronization of the same saved result, never as another Threads publication. External schema changes remain user-controlled.

## Idempotency and failure policy

MongoDB and Threads cannot participate in one shared transaction, so the system cannot promise mathematical exactly-once delivery. The safe goal is to prevent automatic duplicate intent.

| Failure                                                 | MVP behavior                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Notion returns the same page repeatedly                 | Unique `notionPageId` and state check skip it                                  |
| Two workers see one `ready` page                        | Atomic MongoDB claim allows one winner                                         |
| Text is empty or too long                               | Reject before claiming or calling Threads                                            |
| Process crashes before publication starts               | Resume from the stored safe state                                              |
| Publication may have occurred but no response was saved | Mark/retain `publish_started`; require reconciliation and never auto-republish |
| Threads returns a post ID but Notion update fails             | Store the Threads result, then retry only the Notion update                          |
| Notion or Threads returns a rate limit                        | Respect retry guidance and back off only where retry is safe                   |
| Token expires                                           | Stop with a credential-specific error; do not treat it as a content failure    |
| Analytics runs overlap                                  | Add a MongoDB lease when analytics scheduling is introduced                    |
| A metric is unavailable                                 | Leave it unset and continue updating supported metrics                         |

Dry-run mode may read configuration and Notion data, but it must not publish to Threads, update Notion, or write a publication record. No paid service is authorized by a read-only diagnostic.

## Authentication and secrets

This is a single-user integration.

- Local secrets live in an ignored `.env` file.
- Production secrets will use the deployment platform's environment/secret facility.
- Notion tokens, Threads app/user credentials required by the selected authentication flow, and MongoDB credentials are server-only.
- Secrets are never included in structured log fields or user-facing errors.
- Phase 3 uses Threads user authorization with `threads_basic` and `threads_content_publish`; app credentials alone are not the publishing identity.
- Start with the owner's Threads Tester role and accepted invitation. Supporting users without an app role requires App Review and a published app.
- Stage 3 uses the dashboard-generated long-lived owner token. A custom OAuth callback is not necessary for this selected single-owner flow. If added later, use the Threads app identity, exact registered redirect URI, and state validation; do not copy X PKCE assumptions.
- Manual refresh is implemented through `threads:refresh`, gated by DRY_RUN=false and interactive confirmation. The returned token and expiry go to an exclusive 0600 `.env.threads-refreshed` file, never the console. The user transfers the value into `.env`; neither publishing nor profile reads silently refresh credentials.
- Refresh requires an unexpired long-lived token at least 24 hours old. Honor returned expiry; expired/revoked tokens require fresh authorization. Permission grants are separate and may require renewed consent. [Threads token lifecycle](https://developers.facebook.com/documentation/threads/get-started/long-lived-tokens).

## Execution model

The repository is one codebase with multiple entry points:

- an HTTP entry point for health checks and future callbacks
- a finite publishing CLI command
- a later finite analytics CLI command

For the MVP, jobs run manually. In production, an external scheduler should invoke the finite command. An in-process `setInterval` is not reliable across restarts, deployments, or multiple replicas.

Stage 5 now implements `publication:run` as a finite automatic entry point. Human-set ready status is approval only when both automatic opt-in and live mode are enabled; manual commands retain interactive confirmation (ADR 006). The job considers at most ten candidates, prioritizing persisted published results for synchronization, and does not retry a failed request within the run. The metadata-aware reader and existing publication/synchronization services remain the business path.

A local directory lock prevents job overlap within one checkout; MongoDB unique claims remain the cross-process publication guard. SIGINT/SIGTERM request a cooperative stop: finish and persist in-flight results, then do not start another side effect. Hard interruption retains both the publication history and potentially a stale local lock for inspection. No automatic claim reclaim exists. The inactive macOS template and operational limitations are documented in [recurring execution](recurring-execution.md).

A queue is postponed. It adds infrastructure while not eliminating the ambiguous external side effect between Threads and MongoDB.

## Local and production environments

### Local development

- Node.js 24 and npm
- Fastify on loopback by default
- Local MongoDB Community Server 8.0 through Docker Compose, selected on 2026-10-20; loopback-only port and persistent named volume. No authentication in this local-only setup; do not expose or deploy it. Node.js continues running directly on the host.
- `.env` for local secrets
- manual CLI execution

### Production direction

- the same build artifact and finite commands
- platform-managed secrets
- managed MongoDB only after its limits and cost are approved
- external scheduler with overlap protection
- centralized structured logs and basic availability monitoring
- current security-patched Node 24 LTS runtime

No deployment provider or paid infrastructure has been selected.

## API documentation baseline

Notion application code uses API version `2026-03-11` and the official SDK 5.x. The user successfully ran the schema and ready-post commands against their existing data source. See PROJECT_CONTEXT.md for exact verification dates and remaining checks.

Threads documentation reviewed in the browser on 2026-10-05 and 2026-10-06:

- [Get started](https://developers.facebook.com/documentation/threads/get-started): app/tester setup, permissions, user tokens, exchange and refresh.
- [Posts](https://developers.facebook.com/documentation/threads/posts): two-step publication, a 500-character limit with emoji UTF-8 byte weighting, and a five-unique-link limit. Local validation counts non-emoji code points and weights emoji clusters by bytes. It is a conservative preflight, not exact parity with Meta's private counter; server-side rejection remains authoritative. The original Notion nonempty-text rule is unchanged.
- [Overview](https://developers.facebook.com/documentation/threads/overview): 250 API-published posts per profile in a rolling 24-hour window, plus other request limits.
- No required subscription or per-post billing step appears in the reviewed setup. This supports the selected no-paid-API path, not a guarantee of permanent free pricing.

Profile read access was manually verified. Publication and refresh implementations have mocked checks but have not been exercised against Meta. The isolated publisher is not the production ledger-backed workflow; it has no cross-run duplicate protection. Analytics permissions and supported metrics remain Phase 6 work.

## Decisions

| Decision             | MVP choice                                                 |
| -------------------- | ---------------------------------------------------------- |
| Package manager      | npm                                                        |
| Account model        | one owner/Threads account                                        |
| Trigger              | manual CLI, then polling                                   |
| Persistence          | MongoDB when Phase 4 begins                                |
| MongoDB client       | official driver, no Mongoose                               |
| Local MongoDB        | Reconfirm Docker versus a managed free cluster in Phase 4  |
| Process architecture | one codebase, separate entry points                        |
| Scheduling           | external scheduler later                                   |
| Queue                | postponed                                                  |
| AI                   | outside MVP and always approval-gated                      |
| Node version         | supported Node 24; verify the active runtime before checks |
