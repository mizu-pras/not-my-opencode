# src/hooks/todo-continuation/

## Responsibility

Implement orchestrator-only auto-continuation for incomplete todo lists with
strict safety controls so automation does not loop or fight the user. Also host
todo-state hygiene reminders after relevant tool actions.

## Design

- `createTodoContinuationHook(ctx, config?)` returns:
  - `handleMessagesTransform`
  - `handleToolExecuteAfter`
  - `handleEvent`
  - `handleChatMessage`
  - `handleCommandExecuteBefore`
  - `tool.auto_continue`
- `ContinuationState` tracks enabled state, consecutive continuation count,
  cooldown timer, abort suppress window, orchestrator session IDs, in-flight
  notifications, and auto-injection guards.
- `requestSignatureBySession` dedupes repeated transforms for the same user
  request and lets hygiene instructions be re-applied or stripped
  deterministically.
- `todo-hygiene.ts` keeps separate reminder state: `TodoWrite` arms active
  cycles, later tools can mark `general` or `final_active` reminders, and
  injection happens as an appended `<instruction name="todo_hygiene">` block on
  the latest external user text.

## Flow

### Auto-continuation

1. `handleMessagesTransform` finds the latest external user message, infers its
   session, tracks orchestrator sessions, resets per-request hygiene state, and
   appends/removes a pending hygiene instruction for duplicate transforms.
2. On `session.idle` or idle `session.status`, the hook checks orchestrator
   routing, optional auto-enable threshold, incomplete todos, last-assistant
   question state, continuation limits, abort suppress window, and pending
   timer/injection guards.
3. If all gates pass, it sends a no-reply countdown notification via
   `session.prompt` and starts the cooldown timer.
4. When the timer fires, it injects `CONTINUATION_PROMPT` via `session.prompt`
   using an internal-agent text part and increments
   `consecutiveContinuations`.
5. `session.status: busy` cancels pending timers for user-driven orchestrator
   activity and resets the continuation counter when appropriate.
6. Abort-like `session.error` events start a short suppress window and cancel
   pending timers.
7. `session.deleted` clears orchestrator, notification, timer, and dedupe state.

### Command/tool paths

1. `tool.auto_continue` toggles the global enabled flag programmatically.
2. `handleCommandExecuteBefore` intercepts `/auto-continue`, seeds the current
   session as orchestrator-owned, toggles `on`/`off`/flip state, and returns an
   internal status response directly in `output.parts`.
3. `handleChatMessage` learns orchestrator session IDs from runtime traffic for
   serve-mode consistency.

### Todo hygiene

1. `todo-hygiene.handleToolExecuteAfter` ignores `auto_continue`, resets active
   cycles on `TodoWrite`, and arms reminders after later tools when open todos
   still exist.
2. `final_active` takes precedence when exactly one open todo remains and it is
   `in_progress`; otherwise `general` hygiene is used.
3. `todo-hygiene.handleEvent` clears hygiene state on `session.deleted`.

## Integration

- Registered in `src/index.ts` across:
  - `experimental.chat.messages.transform`
  - `chat.message`
  - `command.execute.before`
  - `event`
  - `tool.execute.after`
- Uses shared utilities `log`, `createInternalAgentTextPart`,
  `SLIM_INTERNAL_INITIATOR_MARKER`, and `withTimeout`.
