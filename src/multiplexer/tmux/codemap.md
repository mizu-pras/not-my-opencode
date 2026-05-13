# src/multiplexer/tmux/

## Responsibility

- Implement the tmux backend for `Multiplexer`.
- Spawn `opencode attach` panes, rename them, and rebalance tmux layout after spawn/close bursts.

## Main behavior

- `TmuxMultiplexer` caches tmux binary discovery in `binaryPath`/`hasChecked`.
- `targetPane` captures `TMUX_PANE` once and is reused through `targetArgs()` so layout and split operations stay scoped to the originating pane/window.
- All subprocesses run through `crossSpawn(...)` for Node/Bun compatibility.

## Lifecycle

- `spawnPane(sessionId, description, serverUrl, directory)`:
  - resolves the tmux binary via `which`/`where` + `tmux -V` validation;
  - shell-quotes URL, session id, and directory;
  - runs `tmux split-window -h -d -P -F '#{pane_id}' ... 'opencode attach ...'`;
  - renames the pane to the first 30 chars of `description`;
  - schedules a debounced layout rebalance instead of applying layout immediately.

- `closePane(paneId)`:
  - sends `C-c` first for graceful shutdown;
  - waits 250ms;
  - kills the pane;
  - schedules the same debounced layout rebalance on success.

- `applyLayout(layout, mainPaneSize)`:
  - cancels any pending debounced layout run;
  - applies `select-layout` immediately;
  - for `main-horizontal` / `main-vertical`, also sets `main-pane-height` or `main-pane-width` and reapplies the layout.

## Layout strategy

- `scheduleLayout()` debounces repeated spawn/close bursts with `TMUX_LAYOUT_DEBOUNCE_MS`.
- `layoutGeneration` prevents stale timers from applying old layout state after a newer change.
- Stored layout settings are updated by `applyLayoutNow(...)` and reused for deferred rebalances.

## Integration

- Selected by `src/multiplexer/factory.ts` when config type is `tmux` or auto-detect sees `TMUX`.
- Used only through `MultiplexerSessionManager`; session ownership/lifecycle decisions live one layer up.
