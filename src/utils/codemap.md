# src/utils/

## Responsibility

Cross-cutting runtime helpers for session orchestration, resumable-task memory, prompt shaping, runtime compatibility, and small infrastructure concerns.

## Important files

- `session.ts`: prompt timeout, abort timeout, model parsing, assistant-text extraction.
- `session-manager.ts`: parent-scoped resumable `task` session store and prompt formatter.
- `subagent-depth.ts`: nested child-session depth tracking.
- `system-collapse.ts`: in-place system-message collapse.
- `internal-initiator.ts`: invisible marker for plugin-injected text parts.
- `polling.ts`: generic polling loop + delay helper.
- `env.ts`: Bun/Node env lookup.
- `compat.ts`: cross-runtime process spawn/file write helpers.
- `task.ts`: `task_id` extraction from tool output.
- `logger.ts`, `agent-variant.ts`, `zip-extractor.ts`, `index.ts`: supporting utilities and exports.

## Session helpers (`session.ts`)

- `parseModelReference('provider/model')` validates and splits model strings for OpenCode prompt bodies.
- `promptWithTimeout(...)` races `session.prompt(...)` against timeout and optional abort signal:
  - on timeout it best-effort aborts the session via `abortSessionWithTimeout(...)`;
  - on abort it throws `Prompt cancelled`.
- `extractSessionResult(...)` reads all assistant messages and concatenates `text` parts plus optional `reasoning` parts; it returns `{ text, empty }` so callers can distinguish silent provider output from normal content.
- `shortModelLabel(...)` trims `provider/` for display/logging.

## Resumable task memory (`session-manager.ts`)

- Stores sessions by `{ parentSessionId, agentType }` with stable aliases like `exp-1`, `fix-2`, `cnc-1`.
- `deriveTaskSessionLabel(...)` prefers explicit description, then first prompt line, then `recent {agentType} task`.
- `remember`, `resolve`, `markUsed`, `drop`, `dropTask`, and `clearParent` manage reuse and eviction.
- Tracks recently read context files per task and formats them into `### Resumable Sessions` prompt text.
- Context file retention is filtered by minimum line count and capped by recent-read ordering.

## Depth / system / marker helpers

- `SubagentDepthTracker` assigns child depth as `parentDepth + 1`, blocks registration past `maxDepth`, and cleans state per session or globally.
- `collapseSystemInPlace(system)` mutates the original array reference, joining entries with blank lines and removing empty single-entry arrays.
- `createInternalAgentTextPart(...)` appends `<!-- SLIM_INTERNAL_INITIATOR -->`; `hasInternalInitiatorMarker(...)` lets consumers filter plugin-internal prompts back out of user-visible state.

## Runtime helpers

- `pollUntilStable(...)` repeatedly calls an async fetcher until the caller-defined stability predicate passes for the configured threshold, or timeout/abort occurs.
- `getEnv(...)` checks `Bun.env` first, then `process.env`, ignoring empty strings.
- `crossSpawn(...)` wraps `node:child_process.spawn` behind a Bun-like interface with collected stdout/stderr promises.
- `crossWrite(...)` normalizes binary/string writes.
- `parseTaskIdFromTaskOutput(...)` extracts `task_id:` tokens from tool output lines.

## Integration notes

- `src/council/council-manager.ts` depends on `session.ts` and `subagent-depth.ts`.
- `src/hooks/task-session-manager/` uses `SessionManager`, `parseTaskIdFromTaskOutput`, and `collapseSystemInPlace`.
- `src/interview/service.ts` uses the internal initiator marker to hide plugin-injected prompts from parsed interview state.
- `src/multiplexer/*` uses `compat.ts` directly; pane helpers are no longer housed in a separate `utils/tmux.ts` file.
- `index.ts` currently re-exports only a subset of utilities (`agent-variant`, `env`, `internal-initiator`, `logger`, `polling`, `session`, `session-manager`, `task`, `zip-extractor`).
