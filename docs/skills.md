# Skills

Skills are prompt-based capabilities assigned per agent. They are not MCP
servers. The installer processes them when `--skills=yes`.

## Installed skills

| Skill | Purpose | Default agent |
|---|---|---|
| `agent-browser` | Browser automation, screenshots, UI checks | `designer` |
| `simplify` | Behavior-preserving simplification | `oracle` |
| `codemap` | Repository architecture maps | `orchestrator` |
| `clonedeps` | Local source mirrors for key dependencies | `orchestrator` |

Sources:

- `agent-browser`: `https://github.com/vercel-labs/agent-browser`
- `simplify`: bundled in `src/skills/simplify`
- `codemap`: bundled in `src/skills/codemap`
- `clonedeps`: bundled in `src/skills/clonedeps`

## Assignment syntax

Configure skills in `~/.config/opencode/not-my-opencode.json`:

| Value | Meaning |
|---|---|
| `["*"]` | all installed skills |
| `["*", "!agent-browser"]` | all except one skill |
| `["simplify"]` | only listed skills |
| `[]` | no skills |
| `["!*"]` | deny all |

Deny rules win when entries conflict.

Example:

```jsonc
{
  "presets": {
    "custom": {
      "orchestrator": { "skills": ["codemap", "clonedeps"] },
      "oracle": { "skills": ["simplify"] },
      "designer": { "skills": ["agent-browser"] },
      "fixer": { "skills": [] }
    }
  }
}
```

## Related docs

- [Codemap](codemap.md)
- [Clonedeps](clonedeps.md)
- [Default integrations](default-integrations.md)
