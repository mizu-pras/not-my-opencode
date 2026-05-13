# src/hooks/task-session-manager/

## Responsibility

Provide resumable-task state for `task` tool calls so orchestrator users can
resume work with short aliases (`exp-1`, `ora-2`) instead of raw child session
IDs, while also carrying forward lightweight read-context hints.

## Design

- `createTaskSessionManagerHook(ctx, options)` returns handlers for:
  - `tool.execute.before`
  - `tool.execute.after`
  - `experimental.chat.messages.transform`
  - `event`
- `SessionManager` stores remembered task sessions with bounded per-agent
  history and alias generation.
- Pending calls are tracked by `callID` in a capped ordered map so input
  rewrites and later task output can be correlated safely.
- `contextByTask` aggregates parsed `Read` output paths/line numbers and feeds
  summarized context into `SessionManager.addContext(...)`.
- `pendingManagedTaskIds` bridges `session.created` for child sessions and the
  later `task` output that reveals the durable task ID.
- `shouldManageSession(sessionID)` limits behavior to orchestrator-managed
  parents.

## Flow

1. `tool.execute.before` intercepts managed `task` calls, derives a label, and
   records pending metadata.
2. If `args.task_id` is present, resolve aliases for the current parent
   session/agent; unresolved aliases are removed to force fresh task creation.
3. Successful alias resolution rewrites `args.task_id` to the real child
   session ID and remembers the resumed ID for later stale-alias cleanup.
4. `tool.execute.after` on `task` parses returned task IDs; missing-session
   resume failures drop stale aliases.
5. If a resumed task returns a different ID, the stale predecessor alias is
   dropped and the new task is remembered.
6. `tool.execute.after` on `Read` harvests `<path>...</path>` plus numbered line
   references and associates that context with managed task IDs.
7. `experimental.chat.messages.transform` appends a
   `<resumable_sessions>...</resumable_sessions>` block to the latest
   orchestrator user message when remembered sessions exist.
8. `event.session.created` marks child sessions spawned under managed parents as
   pending managed tasks.
9. `event.session.deleted` clears task aliases, pending calls, tracked context,
   and parent-session state.

## Integration

- Wired in `src/index.ts` across `tool.execute.before`, `tool.execute.after`,
  `experimental.chat.messages.transform`, and `event`.
- Depends on `SessionManager`, `deriveTaskSessionLabel`,
  `parseTaskIdFromTaskOutput`, and `ContextFile` helpers from `src/utils/`.
