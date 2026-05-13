# src/hooks/post-file-tool-nudge/

## Responsibility

Append a one-shot internal workflow reminder directly to `Read`/`Write` tool
output so orchestrator sessions get an immediate post-file-action nudge.

## Design

- `createPostFileToolNudgeHook(options?)` exposes only `tool.execute.after`.
- `FILE_TOOLS` is the canonical set `{ 'Read', 'read', 'Write', 'write' }`.
- `appendReminder(output)` mutates only string tool output and skips duplicate
  reminder insertion.
- Optional `shouldInject(sessionID)` can suppress nudges per session before
  output mutation.

## Flow

1. On `tool.execute.after`, match `Read`/`Write` tool names and require
   `sessionID`.
2. If `shouldInject(sessionID)` returns false, stop.
3. If `output.output` is a string and does not already contain the reminder,
   append an `<internal_reminder>` block carrying `PHASE_REMINDER_TEXT`.

## Integration

- Registered via `src/hooks/index.ts` and plugin lifecycle wiring.
- Mutates tool output directly; no queued state, system-transform stage, or
  event cleanup remains.
