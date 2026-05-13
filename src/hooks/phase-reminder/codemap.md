# src/hooks/phase-reminder/

## Responsibility

Keep orchestrator guidance aligned over long turns by appending a phase
reminder to the latest orchestrator user message before the next LLM request.

## Design

- `PHASE_REMINDER` wraps `PHASE_REMINDER_TEXT` in
  `<internal_reminder>...</internal_reminder>`.
- `createPhaseReminderHook()` returns one
  `experimental.chat.messages.transform` handler.
- The hook scans backward for the latest user message, limits itself to
  orchestrator/unspecified agent turns, skips internal initiator messages, and
  avoids duplicate reminder injection.
- Mutation target is the first text part in that latest user message.

## Flow

1. Scan backward for the latest `info.role === 'user'`.
2. Skip non-orchestrator agent turns.
3. Find the first text part.
4. Skip if the part already contains `SLIM_INTERNAL_INITIATOR_MARKER` or
   `PHASE_REMINDER`.
5. Replace the outbound message entry with cloned parts containing
   `\n\n---\n\n${PHASE_REMINDER}`, avoiding mutation of the original persisted
   message object.

## Integration

- Registered through `src/hooks/index.ts` and plugin hook wiring in
  `src/index.ts`.
- Mutates outgoing `messages` payload only; no client or network state.
