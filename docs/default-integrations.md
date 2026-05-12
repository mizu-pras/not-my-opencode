# Default Integrations

This page documents what `not-my-opencode` installs, enables, or wires by
default.

## Skills

The installer defaults to `--skills=yes`, so these skills are processed during
`not-my-opencode install` unless you pass `--skills=no`.

### Installed from external sources

| Skill | Installed from | Default agent | Notes |
|---|---|---|---|
| `agent-browser` | `https://github.com/vercel-labs/agent-browser` via `npx skills add` | `designer` | Runs `npm install -g agent-browser` and `agent-browser install` after adding the skill. |

### Bundled with this repo

| Skill | Source path | Default agent | Notes |
|---|---|---|---|
| `simplify` | `src/skills/simplify` | `oracle` | Behavior-preserving simplification and readability review. |
| `codemap` | `src/skills/codemap` | `orchestrator` | Hierarchical repository mapping. |

### Permission-only skills

| Skill | Default agent | Installed by CLI? | Notes |
|---|---|---|---|
| `requesting-code-review` | `oracle` | No | Permission grant only for externally managed review workflows. |

Generated configs assign skills like this by default:

| Agent | Default skills |
|---|---|
| `orchestrator` | `*` |
| `oracle` | `simplify` |
| `designer` | `agent-browser` |
| Other built-ins | none unless explicitly configured |

## MCP servers

The plugin ships these built-in MCP definitions. They are available at runtime
unless disabled with `disabled_mcps`.

| MCP | Purpose | Endpoint / provider |
|---|---|---|
| `websearch` | Web search | Exa by default: `https://mcp.exa.ai/mcp?tools=web_search_exa`. Uses `EXA_API_KEY` if set. Can be configured for Tavily with `TAVILY_API_KEY`. |
| `context7` | Official library documentation | `https://mcp.context7.com/mcp`. Uses `CONTEXT7_API_KEY` if set. |
| `grep_app` | GitHub code search | `https://mcp.grep.app`. |

Default MCP access per agent:

| Agent | Default MCPs |
|---|---|
| `orchestrator` | `*`, `!context7` |
| `librarian` | `websearch`, `context7`, `grep_app` |
| `designer` | none |
| `oracle` | none |
| `explorer` | none |
| `fixer` | none |
| `observer` | none |
| `council` | none |
| `councillor` | none |

## OpenCode plugin entries

The installer adds `not-my-opencode` to the OpenCode `plugin` array. If the
installer is run from a local checkout, the entry may be the local package root
instead of the package name.

When TUI integration is enabled (the default), the installer also writes the
same plugin entry to the OpenCode TUI config.

## Runtime tools provided by this plugin

The plugin registers these tools internally:

- `webfetch`
- `ast_grep_search`
- `ast_grep_replace`
- `subtask`
- `read_session`
- council tools when council is configured

## Default agent permission posture

The built-in agents are permission-shaped in the same spirit as OpenCode's
built-in task agents: narrow roles, explicit tool boundaries, and no privilege
escalation through nested delegation.

| Agent | Default posture |
|---|---|
| `explorer`, `oracle`, `observer` | Read-only profile: deny all by default, then allow local read/search tools such as `read`, `glob`, `grep`, `lsp`, `list`, `codesearch`, and `ast_grep_search`. |
| `librarian` | Research-only: denies file edits, shell commands, and nested delegation. External docs/code search access is controlled by MCP config. |
| `fixer`, `designer` | Can perform scoped implementation work, but nested delegation tools are denied by default. |
| `councillor` | Internal read-only council advisor with explicit read/search permissions and no questions. |

## Runtime dependencies and integrations

Main runtime packages used by the plugin:

- `@opencode-ai/plugin`
- `@opencode-ai/sdk`
- `@modelcontextprotocol/sdk`
- `@ast-grep/cli`
- `@mozilla/readability`
- `jsdom`
- `turndown`
- `lru-cache`

Optional runtime dependency:

- `@opentui/solid`

## Notes

- `observer` is disabled by default through `DEFAULT_DISABLED_AGENTS`, even
  though model defaults may exist in presets.
- `council` is available, but is normally surfaced when council configuration is
  present.
- Passing `--skills=no` skips skill installation, but does not remove existing
  skills from your OpenCode installation.
