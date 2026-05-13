# Agents Directory Codemap

## Responsibility

`src/agents/` builds the runtime agent registry from loaded config and maps it
into OpenCode SDK agent records.

- define built-in agent factories and orchestrator prompt text
- materialize custom agents from `config.agents`
- apply model/prompt/display-name overrides and permission defaults
- expose disabled/enabled agent sets and final SDK registration payloads

## Build pipeline (`index.ts`)

`createAgents(config)`:

1. Compute disabled agents from `config.disabled_agents` or
   `DEFAULT_DISABLED_AGENTS`; protected names stay enabled.
2. Disable `council` entirely when `config.council` is absent.
3. Instantiate built-in subagents from `SUBAGENT_FACTORIES`, loading optional
   prompt files via `loadAgentPrompt(name, config?.preset)`.
4. Discover custom agent names from `config.agents` keys that are neither
   built-ins nor aliases; reject unsafe names and skip entries with no `model`.
5. Apply overrides:
   - string `model` → `config.model`
   - array `model` → `_modelArray` + clear `config.model` for runtime
     resolution/failover
   - merge `variant`, `temperature`, `options`, `displayName`
6. Apply default permissions:
   - read-only tool presets for `explorer`/`oracle`/`observer`
   - no-delegation presets for `librarian`/`fixer`/`designer`
   - `question` allow by default unless explicitly denied
   - `council_session` allow only for `council`
   - nested `skill` permissions from `cli/skills.ts`
7. Apply compatibility fallbacks:
   - `fixer` inherits librarian model when fixer is unconfigured
   - `council` can inherit deprecated `council.master.model`
8. Build orchestrator with disabled-agent-aware prompt sections.
9. Rewrite `@agent` mentions to `@displayName` for orchestrator prompt and any
   custom-agent `orchestratorPrompt` snippets; reject collisions/conflicts.
10. Return `[orchestrator, ...subagents]`.

## Runtime model semantics

- `_modelArray` stores ordered fallback/runtime resolution entries.
- `orchestrator` intentionally defaults to `model: undefined`; runtime hooks can
  resolve from config/manual planning later.
- Per-entry variants in `_modelArray` survive override normalization.

## Registration semantics (`getAgentConfigs`)

- `orchestrator` → `mode: 'primary'`
- normal specialists/custom agents → `mode: 'subagent'`
- `council` → `mode: 'all'`
- `councillor` → `mode: 'subagent'`, `hidden: true`
- every registered agent gets MCP allow-lists from `getAgentMcpList(...)`
- display-name aliases register as visible host keys while the internal name is
  also registered but hidden

## Key integrations

- config inputs: `src/config/{loader,schema,utils,agent-mcps}.ts`
- skill permission defaults: `src/cli/skills.ts`
- runtime consumer: `src/index.ts` loads config, then calls
  `createAgents()` / `getAgentConfigs()`

## Files

- `index.ts` — registry assembly, overrides, default permissions, display names
- `orchestrator.ts` — orchestrator prompt builder and prompt replacement/append
- `council.ts`, `councillor.ts` — council-facing agents
- `explorer.ts`, `librarian.ts`, `oracle.ts`, `designer.ts`, `fixer.ts`,
  `observer.ts` — specialist factory definitions
