# Architecture

Status: MVP design recorded on 2026-07-28; publishing target revised to X (Twitter) on 2026-09-08. See [ADR 004](decisions/004-target-x-twitter.md).

Existing repository and Notion resource names are historical labels; the product has one target, X. Current Notion reading and validation remain in scope. Authentication, text limits, access costs, and analytics must be verified specifically for X before their implementation.

## Goals

- Publish only manually approved Notion content with status `ready`.
- Default to a no-write dry run.
- Never intentionally publish the same Notion page twice.
- Preserve enough state to recover when X succeeds but a later operation fails.
- Keep external API shapes at adapter boundaries rather than spreading them through business logic.
- Start with one understandable Node.js codebase and direct API calls.

## Non-goals for the MVP

- Notion webhooks
- scheduled posts or an internal cron loop
- queues or microservices
- multiple X users
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
X API
  1. Create a text post (POST /2/tweets)
  2. Receive the published post ID
        |
        v
MongoDB publication record
  - X post ID
  - publication state
  - sanitized errors and retry information
        |
        | safe, repeatable update
        v
Notion page
  - X post ID and URL
  - publication date
  - Status = published

Later:

External scheduler
        |
        v
Analytics command
        |
        | X post metrics, where access permits
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

### X (Twitter) adapter

Uses native `fetch` with an abort timeout and supported user-context authorization. Text-only publication uses `POST https://api.x.com/2/tweets`, then persists the returned post ID and resolves the public URL. The adapter normalizes API errors and protects credentials. There is no media-container creation stage in the text-only MVP. Authentication setup and access costs are Phase 3 prerequisites. [X create-post reference](https://docs.x.com/x-api/posts/create-post).

### Publication service

Contains the business rules for eligibility, validation, dry-run behavior, state transitions, and recovery. Tests can supply mock Notion, X, and publication-repository implementations.

### MongoDB publication repository

Uses the official MongoDB Node.js driver. It creates unique indexes, atomically claims a Notion page, and persists publication progress. Mongoose is intentionally omitted to avoid introducing an ODM before one provides a demonstrated benefit.

## Internal domain model

External responses are mapped to an internal model similar to:

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

This model is the backend equivalent of converting an API response into stable frontend view-model props. Tests and business rules depend on our representation, not on every field returned by Notion.

## Notion data model

The existing database is still titled `Threads Posts` (a retained label). Its four current fields have been inspected: Name, Text, Topic, and Status. The table below distinguishes those fields from proposed publication fields; this document does not claim the latter were created. Phase 2 still needs reusable expected-schema validation.

| Property | Notion UI type | State / purpose |
| --- | --- | --- |
| `Name` | Title | Exists; internal post title |
| `Text` | Text (API: rich_text) | Exists; text intended for X |
| `Topic` | Select | Exists; topic grouping |
| `Status` | Status | Exists; `draft`, `ready`, `published` |
| `X Post ID` | Text | Planned; published X identifier, stored as a string |
| `X URL` | URL | Planned; public post link |
| `Published At` | Date | Planned; publication time |
| `Sync Status` | Select | Proposed; synchronization progress |
| `Last Error` | Text | Proposed; bounded, sanitized error |
| `Retry Count` | Number | Proposed; safe retry attempts |

Analytics fields and `Metrics Updated At` are postponed to Phase 6; select only metrics actually available with the user's X access. Do not assume metric names, permissions, or availability carry over from the old target. `Scheduled At` is postponed until scheduling is designed. The full ContentPost model and publication properties are still planned, while the working CLI currently returns ReadyPostPreview.

## Publication ledger

The `publications` collection will contain one document per Notion page. Its precise Zod and MongoDB schema will be introduced in Phase 4. Expected fields include:

- `notionPageId` with a unique index
- `contentHash` for detecting content changes during a run
- `state`
- `xPostId`
- `xUrl`
- `publishedAt`
- `attemptCount`
- bounded and sanitized `lastError`
- `createdAt` and `updatedAt`

The planned state machine is (persist `publish_started` before sending the X create-post request):

```text
claimed
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

## Idempotency and failure policy

MongoDB and X cannot participate in one shared transaction, so the system cannot promise mathematical exactly-once delivery. The safe goal is to prevent automatic duplicate intent.

| Failure                                                 | MVP behavior                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Notion returns the same page repeatedly                 | Unique `notionPageId` and state check skip it                                  |
| Two workers see one `ready` page                        | Atomic MongoDB claim allows one winner                                         |
| Text is empty or too long                               | Reject before claiming or calling X                                      |
| Process crashes before publication starts               | Resume from the stored safe state                                              |
| Publication may have occurred but no response was saved | Mark/retain `publish_started`; require reconciliation and never auto-republish |
| X returns a post ID but Notion update fails       | Store the X result, then retry only the Notion update                    |
| Notion or X returns a rate limit                  | Respect retry guidance and back off only where retry is safe                   |
| Token expires                                           | Stop with a credential-specific error; do not treat it as a content failure    |
| Analytics runs overlap                                  | Add a MongoDB lease when analytics scheduling is introduced                    |
| A metric is unavailable                                 | Leave it unset and continue updating supported metrics                         |

Dry-run mode may read configuration and Notion data, but it must not publish to X, update Notion, or write a publication record. Read-only diagnostics do not authorize paid X API calls.

## Authentication and secrets

This is a single-user integration.

- Local secrets live in an ignored `.env` file.
- Production secrets will use the deployment platform's environment/secret facility.
- Notion tokens, X app/user credentials required by the selected authentication flow, and MongoDB credentials are server-only.
- Secrets are never included in structured log fields or user-facing errors.
- Phase 3 must choose supported X user-context authentication; an application-only token is not the publishing identity. OAuth 2.0 Authorization Code with PKCE is a candidate, not an implemented flow.
- For OAuth 2.0, validate state, use PKCE, and register the exact callback URL in the X developer app. Select scopes and refresh handling from current official documentation; no fixed token lifetime is assumed.
- Do not request or provision X credentials until the chosen flow and access requirements are clear. [X OAuth 2.0 guide](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

## Execution model

The repository is one codebase with multiple entry points:

- an HTTP entry point for health checks and future callbacks
- a finite publishing CLI command
- a later finite analytics CLI command

For the MVP, jobs run manually. In production, an external scheduler should invoke the finite command. An in-process `setInterval` is not reliable across restarts, deployments, or multiple replicas.

A queue is postponed. It adds infrastructure while not eliminating the ambiguous external side effect between X and MongoDB.

## Local and production environments

### Local development

- Node.js 24 and npm
- Fastify on loopback by default
- MongoDB starting in Phase 4; Docker versus a managed free cluster will be reconfirmed first
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

X documentation checked for this target change on 2026-09-08:

- Text-post creation: `POST https://api.x.com/2/tweets`; the response includes the published ID. [Create Posts](https://docs.x.com/x-api/posts/create-post).
- User-context authorization must be selected and configured in Phase 3. [OAuth 2.0 Authorization Code with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).
- Confirm access, pricing/credits, and endpoint limits for the user's app before enabling paid calls. No free publishing or analytics allowance is assumed. [X API pricing](https://docs.x.com/x-api/getting-started/pricing).
- Verify X-specific text counting, URL/Unicode treatment, allowed post types, and available metrics before implementing those rules. Only the generic nonempty-text rule exists today.

These are design references, not evidence that X is connected. No X credentials, endpoints, or publication have been tested. The previous platform's container flow, permissions, token lifetime, and text limit are no longer part of this design.

## Decisions

| Decision             | MVP choice                                                |
| -------------------- | --------------------------------------------------------- |
| Package manager      | npm                                                       |
| Account model        | one owner/X account                                 |
| Trigger              | manual CLI, then polling                                  |
| Persistence          | MongoDB when Phase 4 begins                               |
| MongoDB client       | official driver, no Mongoose                              |
| Local MongoDB        | Reconfirm Docker versus a managed free cluster in Phase 4 |
| Process architecture | one codebase, separate entry points                       |
| Scheduling           | external scheduler later                                  |
| Queue                | postponed                                                 |
| AI                   | outside MVP and always approval-gated                     |
| Node version         | supported Node 24; verify the active runtime before checks |
