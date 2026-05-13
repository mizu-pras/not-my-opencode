# Default Integrations

What `not-my-opencode install` wires by default.

## Skills

| Skill | Source | Default agent |
|---|---|---|
| `agent-browser` | `https://github.com/vercel-labs/agent-browser` via `npx skills add` | `designer` |
| `simplify` | bundled: `src/skills/simplify` | `oracle` |
| `codemap` | bundled: `src/skills/codemap` | `orchestrator` |
| `clonedeps` | bundled: `src/skills/clonedeps` | `orchestrator` |

`agent-browser` also runs:

```bash
npm install -g agent-browser
agent-browser install
```

Permission-only skill:

| Skill | Default agent | Installed by CLI? |
|---|---|---|
| `requesting-code-review` | `oracle` | No |

## MCPs

| MCP | Purpose | Default access |
|---|---|---|
| `websearch` | Web search | `orchestrator`, `librarian` |
| `context7` | Library docs | `librarian` |
| `grep_app` | GitHub code search | `orchestrator`, `librarian` |

## Plugin entries

The installer adds the plugin to OpenCode config and attempts to add the same
entry to TUI config.

| File | Purpose |
|---|---|
| `~/.config/opencode/opencode.json` | OpenCode plugin loading |
| `~/.config/opencode/tui.json` | Companion TUI sidebar/badge |

Local checkout installs may use a file path instead of the package name.

## Plugin tools

- `webfetch`
- `ast_grep_search`
- `ast_grep_replace`
- `subtask`
- `read_session`
- council tools when council is configured

## Notes

- `observer` is disabled by default unless a preset enables it.
- `--skills=no` skips skill installation but does not remove existing skills.
