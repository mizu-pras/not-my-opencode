# src/hooks/

This directory is the plugin-level hook composition surface. It exports
factories and managers consumed by `src/index.ts` for prompt transforms,
tool interception, lifecycle listeners, and runtime commands.

## Responsibility

- Expose stable hook entry points without leaking per-feature internals.
- Document which OpenCode hook surfaces each feature occupies.
- Centralize runtime behaviors for patch rewriting, task/session reuse,
  workflow reminders, fallback handling, and startup policy.

## Design

- `src/hooks/index.ts` re-exports per-feature factories and managers.
- Most features follow `create*Hook(...)` and return lifecycle callbacks.
- `ForegroundFallbackManager` is the main exception: an event-driven manager with
  explicit `handleEvent(...)` state.
- Task/todo features maintain small in-memory state machines for aliasing,
  cooldowns, dedupe, and cleanup.
- Runtime integration relies on `PluginInput.client` plus shared utilities such
  as `log`, marker constants, prompt helpers, and session helpers.

## Flow

1. `src/index.ts` imports hook symbols from this folder.
2. Startup creates instances and wires them into OpenCode hook surfaces.
3. Hooks either mutate outgoing payloads (`args`, messages, tool output) or call
   session APIs (`todo`, `messages`, `prompt`, `promptAsync`, `abort`).

## Hook Points

| Hook Point | Purpose | Implementations |
|---|---|---|
| `tool.execute.before` | Pre-process tool inputs | `apply-patch`, `task-session-manager` |
| `tool.execute.after` | Post-process tool outputs | `delegate-task-retry`, `json-error-recovery`, `post-file-tool-nudge`, `task-session-manager`, `todo-continuation` (hygiene arming) |
| `experimental.chat.messages.transform` | Rewrite outbound user content | `filter-available-skills`, `phase-reminder`, `task-session-manager`, `todo-continuation` |
| `chat.headers` | Mutate request headers | `chat-headers` |
| `chat.message` | Track runtime session/agent mapping | `todo-continuation` |
| `command.execute.before` | Handle slash-command UX | `todo-continuation` (`/auto-continue`) |
| `event` | React to session lifecycle and runtime failures | `foreground-fallback`, `todo-continuation`, `auto-update-checker`, multiplexer managers, `task-session-manager` |

## Implementation Notes

- `createApplyPatchHook` rewrites stale-but-safe `apply_patch` hunks and fails
  closed except for plugin-side outside-workspace preflight cases that defer to
  native validation.
- `ForegroundFallbackManager` watches event traffic and re-queues the latest user
  prompt on the next model in a configured chain after aborting a rate-limited
  foreground request.
- `createTodoContinuationHook` owns auto-continue timers, suppress windows,
  request-signature dedupe, slash-command toggling, chat-message tracking, and
  todo-hygiene reminder injection.
- `createTaskSessionManagerHook` resolves short task aliases, remembers fresh
  task IDs, tracks read-context hints, and injects resumable-session guidance
  into outgoing orchestrator user messages.

## Integration

- `src/index.ts` is the sole runtime consumer and determines registration order.
- `taskSessionManager` is registered in `tool.execute.before`,
  `tool.execute.after`, `experimental.chat.messages.transform`, and `event`.
- The `src/hooks/*/codemap.md` files document feature internals.
