# not-my-opencode

Lightweight agent orchestration for [OpenCode](https://opencode.ai/).

`not-my-opencode` adds a small specialist team around one orchestrator so work
can be routed by fit: fast codebase scouting, current-doc lookup, architecture
review, UI polish, scoped implementation, and optional multi-model consensus.

This fork is synced from
[`oh-my-opencode-slim`](https://github.com/alvinunreal/oh-my-opencode-slim).

## Install

```bash
bunx not-my-opencode@latest install
```

Non-interactive install:

```bash
bunx not-my-opencode@latest install --no-tui --skills=yes
```

Use OpenCode Go preset:

```bash
bunx not-my-opencode@latest install --preset=opencode-go
```

Then authenticate and refresh models:

```bash
opencode auth login
opencode models --refresh
```

Config lives at:

```text
~/.config/opencode/not-my-opencode.json
```

## Quick config

```jsonc
{
  "$schema": "https://unpkg.com/not-my-opencode@latest/not-my-opencode.schema.json",
  "preset": "openai",
  "presets": {
    "openai": {
      "orchestrator": { "model": "openai/gpt-5.5", "variant": "high", "skills": ["*"], "mcps": ["*", "!context7"] },
      "oracle": { "model": "openai/gpt-5.5", "variant": "high", "skills": ["simplify"], "mcps": [] },
      "council": { "model": "openai/gpt-5.5", "variant": "high", "skills": [], "mcps": [] },
      "councillor": { "model": "openai/gpt-5.4", "variant": "medium", "skills": [], "mcps": [] },
      "librarian": { "model": "openai/gpt-5.4-mini", "variant": "low", "skills": [], "mcps": ["websearch", "context7", "grep_app"] },
      "explorer": { "model": "openai/gpt-5.4-mini", "variant": "low", "skills": [], "mcps": [] },
      "designer": { "model": "openai/gpt-5.4", "variant": "medium", "skills": ["agent-browser"], "mcps": [] },
      "fixer": { "model": "openai/gpt-5.4", "variant": "medium", "skills": [], "mcps": [] }
    }
  }
}
```

All models are replaceable. See [Configuration](docs/configuration.md).

## Agents

| Agent | Use |
|---|---|
| `orchestrator` | Main agent and delegation router |
| `explorer` | Fast read-only codebase reconnaissance |
| `librarian` | External docs, web, and GitHub code research |
| `oracle` | Architecture, debugging, review, simplification |
| `designer` | UI/UX implementation and visual validation |
| `fixer` | Bounded implementation and tests |
| `council` | Optional multi-model consensus |
| `observer` | Optional read-only visual/PDF analysis |

Manual delegation works with `@agentName <task>`.

## Features

- model presets and runtime `/preset` switching
- per-agent skills and MCP permissions
- council synthesis across multiple models
- resumable child-agent sessions
- tmux/zellij multiplexer mirroring
- `/subtask` bounded worker sessions
- `webfetch` and AST-grep tools
- codemap and cloned-dependency-source skills

## Docs

| Doc | Contents |
|---|---|
| [Installation](docs/installation.md) | install, reset, verify, uninstall |
| [Quick reference](docs/quick-reference.md) | docs index |
| [Configuration](docs/configuration.md) | full config schema and examples |
| [Default integrations](docs/default-integrations.md) | installer defaults |
| [Skills](docs/skills.md) | skill list and assignment syntax |
| [MCPs](docs/mcps.md) | MCP access and defaults |
| [Tools](docs/tools.md) | built-in tools |
| [Council](docs/council.md) | multi-model consensus |
| [Multiplexer](docs/multiplexer-integration.md) | tmux/zellij panes |
| [Session management](docs/session-management.md) | child-session reuse |
| [Subtask](docs/subtask.md) | bounded worker sessions |
| [Codemap](docs/codemap.md) | repository maps |
| [Clonedeps](docs/clonedeps.md) | local dependency source mirrors |

## Development

```bash
bun run build
bun run check:ci
bun run typecheck
bun test
```

## License

MIT
