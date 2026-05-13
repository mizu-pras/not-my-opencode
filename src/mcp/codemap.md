# src/mcp/

## Responsibility

- Define built-in MCP connectors and the shared `McpConfig` type union.
- Build the runtime MCP map while honoring disabled entries and websearch provider selection.

## Files

- `index.ts`: registry + `createBuiltinMcps(...)`.
- `types.ts`: `RemoteMcpConfig | LocalMcpConfig` union.
- `websearch.ts`: provider-aware websearch MCP factory.
- `context7.ts`: Context7 remote MCP.
- `grep-app.ts`: grep.app remote MCP.

## Current behavior

- `createBuiltinMcps(disabledMcps, websearchConfig)`:
  - starts from the built-in registry `{ websearch, context7, grep_app }`;
  - filters out any names present in `disabled_mcps`;
  - recreates `websearch` through `createWebsearchConfig(...)` unless websearch is disabled.

- `createWebsearchConfig(...)` supports three providers:
  - `exa` (default): remote MCP at `https://mcp.exa.ai/mcp?tools=web_search_exa`, with `EXA_API_KEY` appended as `exaApiKey` query param when present;
  - `tavily`: remote MCP at `https://mcp.tavily.com/mcp/`, requires `TAVILY_API_KEY`, sends `Authorization: Bearer ...`, `oauth: false`;
  - `brave`: local stdio MCP via `npx -y @brave/brave-search-mcp-server --transport stdio`, requires `BRAVE_API_KEY` in child environment.

- `context7.ts` exports a remote connector for `https://mcp.context7.com/mcp` and passes `CONTEXT7_API_KEY` as a header when available.
- `grep-app.ts` exports a fixed remote connector for `https://mcp.grep.app`.

## Notes

- Websearch is the only built-in MCP with runtime provider switching and can be either `remote` or `local`.
- Missing provider credentials throw during MCP construction, not lazily at tool call time.

## Integration

- `src/index.ts` calls `createBuiltinMcps(...)` during plugin startup.
- `McpName` comes from config; concrete connector shapes are defined here.
