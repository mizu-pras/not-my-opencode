# src/council/

## Responsibility

- Execute council runs for the `council_session` tool.
- Resolve preset/runtime policy from plugin config.
- Spawn councillor child sessions, collect results, and return synthesis-ready text.

## Files

- `council-manager.ts`: runtime engine.
- `index.ts`: barrel export.

## Runtime behavior

- `runCouncil(prompt, presetName, parentSessionId)`:
  - blocks immediately if `SubagentDepthTracker` says the next child depth would exceed `maxDepth`;
  - loads `config.council`, resolves `presetName ?? default_preset ?? 'default'`;
  - fails with user-facing guidance when the preset is missing or empty;
  - sends a best-effort `noReply` status message to the parent session before fan-out;
  - applies `timeout`, `councillor_execution_mode`, and `councillor_retries` defaults from config;
  - returns failure if every councillor fails or times out;
  - otherwise formats results through `formatCouncillorResults(...)` for the council agent.

- `runAgentSession(...)` lifecycle:
  - validates `provider/model` with `parseModelReference`;
  - creates a child session under `parentSessionId`;
  - registers the child with the depth tracker;
  - optionally waits `TMUX_SPAWN_DELAY_MS` when multiplexer/tmux support is enabled;
  - prompts the `councillor` agent with `tools.task = false` and optional `variant`;
  - extracts assistant text via `extractSessionResult(..., { includeReasoning: false })`;
  - treats zero extracted text as `Empty response from provider` when `fallback.retry_on_empty !== false`;
  - always aborts the child session and cleans depth tracking in `finally`.

- `runCouncillors(...)`:
  - serial mode runs councillors one-by-one;
  - parallel mode launches all councillors concurrently;
  - parallel launches are staggered by `COUNCILLOR_STAGGER_MS` only when tmux-backed pane spawning is active.

- `runCouncillorWithRetry(...)`:
  - retries only empty-response failures;
  - converts timeout errors to `timed_out` status;
  - preserves other exceptions as per-councillor `failed` results without aborting the rest of the council.

## Result shape

- Per councillor:
  - `completed` + `result`
  - `failed` + `error`
  - `timed_out` + `error`
- Overall:
  - `success: false` for missing config, bad preset, depth overflow, or zero completed councillors.
  - `success: true` with formatted synthesis input once at least one councillor completes.

## Integration

- `src/tools/council.ts` is the caller-facing entrypoint.
- `src/index.ts` constructs `CouncilManager` with plugin context, config, depth tracker, and multiplexer state.
- `src/agents/council.ts` owns councillor prompt/result formatting; this folder only executes.
