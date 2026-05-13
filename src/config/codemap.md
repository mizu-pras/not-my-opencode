# Config Module Codemap

## Responsibility

`src/config/` owns config schema, load/merge rules, preset composition, prompt
lookup, MCP defaults, config-hook composition helpers, and runtime preset state
shared across plugin re-inits.

## Main entrypoints

- `loadPluginConfig(directory, options?)` — runtime loader used by `src/index.ts`
- `PluginConfigSchema` — authoritative schema for user/project config
- `loadAgentPrompt(agentName, preset?)` — prompt file discovery for agents
- `configureOpenCodeConfig()` — OpenCode config-hook composition used by
  `src/index.ts`
- `runtime-preset.ts` — process-local active/previous runtime preset tracking

## Load/merge pipeline (`loader.ts`)

`loadPluginConfig(directory)`:

1. Resolve user config from `getConfigSearchDirs()` (`OPENCODE_CONFIG_DIR`, then
   XDG/default config dir), preferring `.jsonc` over `.json`.
2. Resolve project config from
   `<directory>/.opencode/not-my-opencode.(jsonc|json)`.
3. Parse JSONC via `stripJsonComments`; invalid JSON, schema errors, and read
   errors are downgraded to warnings and ignored for that file.
4. Merge user + project config with project precedence; nested deep merges are
   applied for `agents`, `tmux`, `multiplexer`, `interview`, `sessionManager`,
   `fallback`, and `council`.
5. Migrate legacy `tmux` config into `multiplexer` when no explicit modern
   multiplexer config exists.
6. Override `config.preset` from `OH_MY_OPENCODE_SLIM_PRESET` when present.
7. If the selected preset exists, merge `presets[preset]` into root
   `config.agents` so root agent overrides still win.
8. Warn on missing preset names instead of throwing.

## Presets and runtime switching

- Static config presets live in `PluginConfig.presets` and are selected by
  `config.preset` or `OH_MY_OPENCODE_SLIM_PRESET`.
- `runtime-preset.ts` keeps `activeRuntimePreset` and
  `previousRuntimePreset` at module scope so runtime preset changes survive
  `client.config.update()`-triggered plugin reinitialization in the same process.
- helpers:
  - `setActiveRuntimePreset()` / `getActiveRuntimePreset()`
  - `setActiveRuntimePresetWithPrevious()` / `getPreviousRuntimePreset()`
  - `rollbackRuntimePreset()` for failed switches

## Config-hook composition

- `plugin-config-hook.ts` applies the OpenCode config hook in one place:
  default agent selection, plugin-agent shallow merge, startup model resolution,
  runtime preset override/reset, TUI model snapshot recording, MCP merge and
  permission synthesis, and slash command registration.
- `model-resolution.ts` owns ordered model-array and fallback-chain helpers used
  both by the config hook and by foreground runtime fallback setup.

## Schema surface (`schema.ts`)

- agent overrides support:
  - `model` as string or ordered fallback array of strings / `{id, variant}`
  - `temperature`, `variant`, `options`, `skills`, `mcps`, `displayName`
  - `prompt` and `orchestratorPrompt` only for custom agents
- top-level config includes:
  - `preset`, `presets`, `manualPlan`, `fallback`
  - `multiplexer` plus legacy `tmux`
  - `interview`, `sessionManager`, `todoContinuation`, `council`
- `CouncilConfigSchema` captures deprecated master-model fields into
  compatibility metadata used by agent creation

## Prompt and MCP helpers

- `loadAgentPrompt()` searches `not-my-opencode/` prompt roots in config dirs,
  with optional preset-scoped subdirectories, for `<agent>.md` and
  `<agent>_append.md`
- `agent-mcps.ts` provides default MCP allow-lists plus wildcard/exclusion
  parsing for agent-specific overrides
- `utils.ts` resolves alias-aware agent overrides and detects custom agent keys

## Files

- `loader.ts` — config discovery, parsing, deep merge, preset composition
- `runtime-preset.ts` — active/previous runtime preset state
- `schema.ts` — plugin config schema and type exports
- `council-schema.ts` — council config schema + legacy normalization
- `constants.ts` — agent names, default models, delegation/polling constants
- `agent-mcps.ts` — MCP defaults and list parsing
- `model-resolution.ts` — priority model arrays, fallback chains, TUI snapshots
- `plugin-config-hook.ts` — OpenCode config hook composition helpers
- `utils.ts` — override lookup and custom-agent discovery
- `index.ts` — public re-export surface
