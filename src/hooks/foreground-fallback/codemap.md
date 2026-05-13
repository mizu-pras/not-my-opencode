# src/hooks/foreground-fallback/

## Responsibility

Provide reactive model fallback for foreground (interactive) sessions when
rate-limit or quota-limit signals appear in OpenCode event traffic.

## Design

- `index.ts` exports `ForegroundFallbackManager` plus
  `isRateLimitError(error)`.
- Manager state stores per-session current model, inferred agent, tried models,
  trigger dedupe, and in-flight fallback locks.
- Rate-limit detection is regex-driven and inspects both top-level and nested
  error payload fields.
- Re-prompting uses runtime-only `client.session.promptAsync` with parsed
  `{ providerID, modelID }` targets.
- Abort is handled through `abortSessionWithTimeout(...)`, not raw
  `session.abort()`.

## Flow

1. `handleEvent` watches `message.updated`, `session.error`, retry-style
   `session.status`, `subagent.session.created`, and `session.deleted`.
2. Matching events capture model/agent metadata and trigger
   `tryFallback(sessionID)` on rate-limit signals.
3. `tryFallback` enforces feature enablement, one-at-a-time execution, and a 5s
   per-session dedupe window.
4. Chain resolution priority is: exact agent chain, empty if known agent has no
   chain, inferred chain from current model, then flattened all-chain fallback
   only when both agent and model are unknown.
5. The manager fetches the last user message, aborts the stuck prompt with
   timeout handling, waits 500ms, and re-queues the same user parts on the next
   untried model via `promptAsync`.
6. `session.deleted` removes all session bookkeeping.

## Integration

- Wired through plugin-level `event` handling in `src/index.ts`.
- Depends on `ctx.client.session.messages`, `promptAsync`, and abort helpers,
  plus configured fallback chains.
