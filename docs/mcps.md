# MCP Servers

Built-in Model Context Protocol (MCP) servers ship with not-my-opencode and give agents access to external tools — web search, library documentation, and code search.

---

## Built-in MCPs

| MCP | Purpose | Endpoint |
|-----|---------|----------|
| `websearch` | Real-time web search via Exa, Tavily, or Brave | Exa MCP by default, Tavily MCP when configured, or Brave's official MCP server |
| `context7` | Official library documentation (up-to-date) | `https://mcp.context7.com/mcp` |
| `grep_app` | GitHub code search via grep.app | `https://mcp.grep.app` |

---

## Default Permissions Per Agent

| Agent | Default MCPs |
|-------|-------------|
| `orchestrator` | `*`, `!context7` |
| `librarian` | `websearch`, `context7`, `grep_app` |
| `designer` | none |
| `oracle` | none |
| `explorer` | none |
| `fixer` | none |
 | `councillor` | none |

---

## Configuring MCP Access

Control which MCPs each agent can use via the `mcps` array in your preset config (`~/.config/opencode/not-my-opencode.json` or `.jsonc`):

| Syntax | Meaning |
|--------|---------|
| `["*"]` | All MCPs |
| `["*", "!context7"]` | All MCPs except `context7` |
| `["websearch", "context7"]` | Only listed MCPs |
| `[]` | No MCPs |
| `["!*"]` | Deny all MCPs |

**Rules:**
- `*` expands to all available MCPs
- `!item` excludes a specific MCP
- Conflicts (e.g. `["a", "!a"]`) → deny wins

**Example:**

```json
{
  "presets": {
    "my-preset": {
      "orchestrator": {
        "mcps": ["*", "!context7"]
      },
      "librarian": {
        "mcps": ["websearch", "context7", "grep_app"]
      },
      "oracle": {
        "mcps": ["*", "!websearch"]
      },
      "fixer": {
        "mcps": []
      }
    }
  }
}
```

---

## Disabling MCPs Globally

To disable specific MCPs for all agents regardless of preset, add them to `disabled_mcps` at the root of your config:

```json
{
  "disabled_mcps": ["websearch"]
}
```

This is useful when you want to cut external network calls entirely (e.g. air-gapped environments or cost control).

---

## Websearch Providers

Configure the `websearch` MCP provider at the root of your plugin config:

```json
{
  "websearch": {
    "provider": "brave"
  }
}
```

Supported providers:

| Provider | Type | Required env var | Notes |
|---|---|---|---|
| `exa` | Remote MCP | optional `EXA_API_KEY` | Default provider. Falls back to anonymous Exa MCP access when no key is set. |
| `tavily` | Remote MCP | `TAVILY_API_KEY` | Uses Tavily's hosted MCP endpoint. |
| `brave` | Official local MCP server | `BRAVE_API_KEY` | Runs `npx -y @brave/brave-search-mcp-server --transport stdio`. |
