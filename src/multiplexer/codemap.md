# src/multiplexer/

## Responsibility

- Mirror child OpenCode sessions into tmux/zellij panes.
- Choose the active backend from config + environment.
- Keep pane lifecycle aligned with session events, with polling fallback for missed state transitions.

## Main modules

- `factory.ts`: backend selection.
- `session-manager.ts`: pane/session lifecycle manager.
- `types.ts`: shared multiplexer interface and `/health` readiness probe.
- `tmux/`, `zellij/`: concrete backends.

## Factory behavior

- `getMultiplexer(config)` always creates a fresh instance; there is no cache.
- `type: 'none'` disables multiplexing.
- `type: 'auto'` chooses purely from env presence:
  - `TMUX` -> tmux
  - `ZELLIJ` -> zellij
  - otherwise disabled
- `startAvailabilityCheck(...)` is fire-and-forget; it only warms backend availability detection.

## Session manager behavior

- `MultiplexerSessionManager` is enabled only when:
  - config type is not `none`,
  - `getMultiplexer(...)` returned a backend,
  - `multiplexer.isInsideSession()` is true.
- Tracks three distinct states:
  - `sessions`: active pane bindings with timestamps and last-seen state,
  - `knownSessions`: child sessions eligible for later respawn,
  - `spawningSessions` / `closingSessions`: concurrency guards.

- `onSessionCreated(...)`:
  - ignores root sessions or duplicates;
  - records the child as known;
  - waits for any in-flight close of the same session;
  - checks OpenCode server health with `isServerRunning(serverUrl)`;
  - spawns `opencode attach` in the backend pane;
  - closes the pane immediately if it became stale before tracking finished;
  - starts polling once at least one pane is active.

- `onSessionStatus(...)`:
  - `idle` -> close the pane but keep the session known for possible reuse;
  - `busy` -> respawn a pane if the session is known but currently not tracked.

- `onSessionDeleted(...)`:
  - closes the pane and removes the session from `knownSessions`.

- Polling fallback:
  - calls `client.session.status()` on `POLL_INTERVAL_BACKGROUND_MS`;
  - closes panes when sessions become idle, stay missing for `SESSION_MISSING_GRACE_MS`, or exceed the 10-minute `SESSION_TIMEOUT_MS`;
  - stops automatically once there are no tracked or closing panes.

- `cleanup()`:
  - stops polling,
  - waits for in-flight closes,
  - closes all remaining panes,
  - clears tracked/known/spawning state.

## Integration

- Constructed by `src/index.ts` from plugin config and session event hooks.
- Uses backend implementations only through the shared `Multiplexer` contract.
- Exports deprecated alias `TmuxSessionManager = MultiplexerSessionManager` for compatibility.
