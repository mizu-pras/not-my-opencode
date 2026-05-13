# src/tools/

## Responsibility

`src/tools/` is the plugin-facing tool and command registration layer.

- Exposes AST-aware search/replace as `ast_grep_search` and `ast_grep_replace`.
- Exposes remote fetch/extraction as `webfetch`.
- Exposes council execution as `council_session`.
- Exposes delegated child-session work as `subtask`, `read_session`, and `/subtask`.
- Exposes runtime model switching as the `/preset` command hook.

## Export surface

`src/tools/index.ts` re-exports:

- `ast_grep_search`, `ast_grep_replace`
- `createCouncilTool`
- `createWebfetchTool`
- `createSubtaskTool`, `createReadSessionTool`, `createSubtaskCommandManager`, `createSubtaskState`
- `createPresetManager` and `PresetManager`

## Design

- **Factory registration:** every feature returns a `ToolDefinition` or command manager bound to plugin context.
- **Hook/tool split:** slash-command registration/interception lives in manager factories, while pure tool execution stays in feature folders.
- **Text-first responses:** tools return displayable text and optionally emit metadata for richer UI output.

## Tool surfaces

### `council.ts`

- `createCouncilTool(ctx, councilManager)` registers `council_session`.
- Guardrails:
  - requires a `sessionID` in tool context,
  - rejects non-`council` callers when `agent` is present,
  - forwards `prompt`, optional `preset`, and parent session id to `CouncilManager.runCouncil(...)`.
- Success output appends a footer with completed councillor count and short model labels.
- Deprecated council config fields are surfaced as inline warnings instead of hard failures.

### `preset-manager.ts`

- Registers `/preset` if absent in host config.
- Intercepts `/preset` before LLM handling.
- Behavior:
  - no args → list presets and active runtime preset,
  - one token → call `client.config.update({ body: { agent } })` with mapped runtime-safe fields,
  - multi-word arg → refuse and suggest the first token.
- Tracks runtime preset state across plugin re-inits through `config/runtime-preset.ts` and records updated agent models for the TUI snapshot.
- Reset path clears leaked agent overrides from the previous preset by reapplying config-file baselines where possible.

### `subtask/`

- `/subtask` is a prompt-construction command that tells the active agent to call `subtask(...)`.
- `subtask` creates a real child session, injects referenced files as synthetic Read-style text parts, waits for completion, extracts the child result, wraps it in `<subtask_summary>`, then aborts the child session.
- `read_session` is only callable from marked subtask workers and only against the exact source parent session.
- `SubtaskState` plus session event handling prevent nested subtasks and clean up stale worker markers.

### `smartfetch/`

- `createWebfetchTool` registers the public `webfetch` tool.
- Surface supports:
  - `format: text | markdown | html`,
  - `extract_main`, `include_metadata`, `prefer_llms_txt`,
  - bounded timeout,
  - optional binary saving,
  - optional prompt-driven secondary-model post-processing.
- Execution owns permission prompts, URL normalization, llms.txt probing, cache/revalidation, redirect policy, binary/text branching, and final rendering.

### `ast-grep/`

- `ast_grep_search` and `ast_grep_replace` are thin tool wrappers over `runSg(...)`.
- Search surfaces `pattern`, `lang`, optional `paths`, `globs`, and `context`.
- Replace surfaces `pattern`, `rewrite`, `lang`, optional `paths`/`globs`, and `dryRun` defaulting to preview mode.
- The feature folder also exports CLI/bootstrap helpers for binary discovery and download.

## Integration

- `src/index.ts` registers `webfetch`, AST-grep tools, `subtask`, and `read_session` unconditionally.
- `src/index.ts` registers `council_session` only when council config is enabled.
- `src/index.ts` wires `/preset` and `/subtask` through config hooks, command hooks, and session lifecycle events.
