# ADR 006: Ready status authorizes the opt-in recurring publisher

Date: 2026-10-20

Status: accepted by the user

## Context

Interactive confirmation before every write prevents unattended recurring publication. The user explicitly chose automatic publication of ready posts when starting Stage 5.

## Decision

The new finite `publication:run` CLI treats human-set `ready` as approval to publish and synchronize its result. Automatic writes require both `DRY_RUN=false` and `AUTO_PUBLISH_ENABLED=true`. Defaults remain safe. Manual publication commands retain interactive confirmations; this exception does not authorize unrelated external writes.

Use an external scheduler, with no in-process timer or immediate retry loop. One run considers at most ten pages. A local directory lock protects one checkout from overlap, while unique MongoDB claims protect individual publications across processes. Interrupted claims are retained, never automatically reclaimed.

Confirmed published records may retry synchronization only. Saved results are selected independently of Notion ready status so a successful Notion update followed by a lost readback response remains recoverable.

## Consequences

Moving a page to ready has operational consequences once the automatic job is enabled. AI content must remain draft until a human approves it. Do not edit a page during publication. Notion prechecks are not an atomic transaction with its writes or Threads.

Implementing this path is separate from activating a local schedule or running live publication. Neither was performed as part of this change. A stale local lock requires manual inspection. Multiple active schedulers and cross-host synchronization serialization remain outside this local milestone.
