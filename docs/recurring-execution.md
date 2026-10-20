# Recurring publication

Stage 5 supplies a finite job and an inactive macOS scheduler template. No schedule is installed. The user approved treating human-set `ready` as publication approval on 2026-10-20. AI output must remain draft until a human approves it.

## One run

From the project root:

```bash
DRY_RUN=true npm run publication:run
```

This reads Notion and MongoDB, validates fresh content, and emits JSON events with page IDs and actions. It does not print draft text or tokens, connect to Threads, initialize database indexes, or write external data. It creates and removes a local lock under ignored `.data/`.

Live operation requires both `DRY_RUN=false` and `AUTO_PUBLISH_ENABLED=true`. This command has no interactive prompts: every eligible ready page in the batch can be published. The manual `notion:publish` command keeps its confirmations. The private `.env` has not been changed.

Each run selects up to ten candidates, prioritizing saved `published` records that need synchronization, then the oldest ready Notion pages. Reads use actual publication metadata. Existing claims never authorize another publication. Fresh content is reloaded before claiming and again before publication. Confirmed published results use synchronization only, including when Notion already says published after a lost response.

An invalid page or API/database error stops the run with exit code 1. Interrupted claims are reported as `manual_review`, skipped, and cause exit code 1; other selected pages may still be processed. Successful runs exit 0. A local lock conflict exits 75. SIGINT/SIGTERM exit 130/143 unless cleanup fails.

## Repetition and recovery

- No immediate API or whole-job retries. A later scheduled run re-reads current state.
- `claimed`, `container_created`, and `publish_started` remain blocked for manual reconciliation. Never delete publication records to force a retry.
- `published` retries only result synchronization. Conflicting Notion edits stop the job. `notion_synced` does nothing.
- Invalid/blocked old pages can occupy the bounded candidate window and delay newer pages. Resolve these explicitly; the job does not silently discard them or clear their history.
- The local directory lock prevents overlapping job invocations from one checkout. MongoDB's unique page claim remains the publication guard across checkouts/hosts and manual runs. This is not a distributed scheduler lease. Run one scheduler for this account; concurrent Notion synchronization across hosts is not serialized.
- On SIGINT/SIGTERM, finish an in-flight request and preserve known results, then stop before another side effect/page. Network timeouts bound requests. An already sent write cannot be undone; do not force-kill merely because shutdown is not immediate.
- SIGKILL, a crash, or power loss can leave `.data/publication-job.lock`. First stop the scheduler, confirm no job process remains, and inspect publication states. Only then remove the empty lock directory with `rmdir .data/publication-job.lock`. Never remove it automatically based on age, and never delete the database volume.

## macOS launchd template

`ops/local.notion-threads.publication.plist.example` uses an external 15-minute interval and safe dry-run overrides. It runs the compiled CLI directly with an absolute Node 24 path, avoiding dependence on interactive shell initialization. This follows Apple's [launchd job configuration](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html) and [timed-job guidance](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html).

After verification and explicit schedule activation approval:

1. Build with `npm run build`. Rebuild after source changes; the scheduler uses `dist/`.
2. Replace both path placeholders in a local copy. Use the absolute Node 24 executable path and project path, XML-escaping special characters when needed.
3. Create `.data/` before loading the agent so log paths exist. Keep secrets in the private project `.env`, never in the plist. The plist's dry-run environment values override `.env`.
4. Place the configured copy at `~/Library/LaunchAgents/local.notion-threads.publication.plist`.
5. Validate and load the dry-run agent:

```bash
plutil -lint "$HOME/Library/LaunchAgents/local.notion-threads.publication.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/local.notion-threads.publication.plist"
```

Inspect `.data/publication-job.log` and `.data/publication-job-error.log`. Stop before changing the configuration:

```bash
launchctl bootout "gui/$(id -u)/local.notion-threads.publication"
```

Only when live scheduling is approved, change the plist's two mode values to `DRY_RUN=false` and `AUTO_PUBLISH_ENABLED=true`, and reload it. Treat that as enabling automatic publication, not a preview.

This local setup depends on the Mac, user session, network, and MongoDB being available; it is not an always-on deployment. The 15-minute interval is a template default, not an activated schedule or a per-post publishing time. Keep logs private and rotate them manually for now.

## Verification checkpoint

No Stage 5 tests, typecheck, build, formatter, live run, or scheduler activation has been performed. Suggested automated batch when requested:

```bash
npm test -- test/publication-job.test.ts test/notion-publication.test.ts
npm run typecheck
```

Then manually verify dry-run, overlap rejection, graceful interruption, and an explicitly approved live run before marking Stage 5 complete.
