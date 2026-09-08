# ADR 004: Publish from Notion to X (Twitter)

- Status: accepted
- Date: 2026-09-08

## Context

The original plan targeted Threads. After verifying the Notion read commands and the focused empty-text tests, the user chose X (Twitter) instead and requested consistent documentation. No publishing adapter has been implemented, so this does not require migrating an existing publisher.

## Decision

The single publishing target is **Notion → X (Twitter)**. Threads is no longer in scope; a multi-platform abstraction is not required for this change.

Keep the existing boundaries:

- Notion owns editorial content and human approval through `draft`, `ready`, and `published`.
- The application validates eligible content and will publish through the X API.
- MongoDB remains the planned internal publication ledger for claims, recovery, and duplicate protection.
- Publication results and, later, supported analytics return to Notion.
- Optional AI generation comes later and must not bypass human approval.

Reuse the application foundation, Notion connection, database, read commands, and platform-independent nonempty-text validation. The pending live empty-text check and other unfinished Phase 2 work remain pending.

Before Phase 3 implementation, verify current official X API access, pricing, supported user-context authentication, and text-counting rules. Obtain the user's approval before any paid usage or real publication. Do not transfer Threads-specific container flow, permissions, token lifetimes, or text limits to X.

## Retained names and implementation boundary

This decision updates documentation and the environment template, not application behavior or external resources.

- The folder, npm package, and Notion connection remain `notion-threads-automation`.
- The existing Notion database remains `Threads Posts`; keep its existing database/data-source IDs.
- The package description and temporary `GET /posts` mock still contain historical Threads wording. They are not an active integration.
- New planned publication fields are `xPostId` and `xUrl`, with proposed Notion properties `X Post ID` and `X URL`. These fields have not been implemented or added to Notion.
- Unused Threads/Meta placeholders were removed from `.env.example`. X-specific settings will follow the chosen authentication flow. The private local `.env` is unchanged.

No X authentication, API access, cost, or publication has been configured or verified. Naming cleanup can happen separately if useful; it is not a prerequisite for the new target.

## Consequences

The README, project context, agent guidance, architecture, and roadmap now describe one target. Existing Notion work remains useful, while the publishing adapter and later analytics must follow X-specific requirements. All Git operations remain the user's responsibility.
