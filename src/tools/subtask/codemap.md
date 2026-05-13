# src/tools/subtask/

## Responsibility

Implements bounded child-session delegation.

- Defines the `subtask` worker tool and the restricted `read_session` follow-up tool.
- Registers the `/subtask` slash command that instructs the current agent to construct a worker prompt.
- Tracks subtask session lineage so nested workers can be blocked and session cleanup can be enforced.
- Recreates OpenCode Read-tool formatting so selected files can be injected into worker context as synthetic parts.

## Files

- `tools.ts`: tool definitions, child-session lifecycle, transcript formatting.
- `command.ts`: `/subtask` command registration plus session event cleanup.
- `files.ts`: `@file` reference parsing, path sanitization, synthetic file-part creation.
- `state.ts`: in-memory `sessionID -> sourceSessionID` map.
- `vendor.ts`: vendored Read-tool constants/helpers used to match host formatting.
- `index.ts`: public export barrel.

## Flow

1. `/subtask` injects a template telling the active agent to call `subtask(prompt="...", files=[...])`.
2. `createSubtaskTool` rejects nested workers, checks optional depth limits, and creates a child session with `parentID` set to the caller.
3. The tool builds a bounded worker prompt, merges explicit `files[]` with `@path` references found in the prompt, and appends synthetic Read-style file parts from `buildSyntheticFileParts(...)`.
4. The child runs as `agent: 'orchestrator'`; completion is awaited through `promptWithTimeout(...)` and summarized via `extractSessionResult(...)`.
5. The tool returns `task_id` plus a normalized `<subtask_summary>` block, then aborts the child session in `finally`.
6. If the worker lacks context, `read_session` can read only the source parent session transcript, only from a marked subtask session.

## Guardrails

- Nested `subtask` calls are blocked by `SubtaskState.isSubtaskSession(...)`.
- Optional `SubagentDepthTracker` prevents exceeding global delegation depth.
- File injection skips path traversal, directories, unreadable paths, and binary files.
- `read_session` rejects non-worker callers and rejects session ids other than the worker's source parent.
- `session.deleted` handling removes stale worker markers when OpenCode cleans sessions externally.

## Integration

- Registered from `src/index.ts` as the `subtask` and `read_session` tools plus the `/subtask` command manager.
- Depends on `src/utils/session.ts` for child prompt waiting and result extraction.
- Uses vendored Read formatting so worker context matches what OpenCode's native `Read` tool would have produced.
