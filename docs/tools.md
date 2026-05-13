# Tools

Plugin-provided tools beyond OpenCode's standard file, shell, and LSP tools.

## Web

| Tool | Purpose |
|---|---|
| `webfetch` | Fetch docs/pages, extract main content, optionally prefer `llms.txt`. |

`webfetch` blocks unapproved cross-origin redirects and returns cleaner markdown
for docs/articles when possible.

## Code search

| Tool | Purpose |
|---|---|
| `ast_grep_search` | AST-aware search across supported languages. |
| `ast_grep_replace` | AST-aware replacement; dry-run by default. |

Use AST-grep when structure matters more than exact text.

## Subtask

| Tool | Purpose |
|---|---|
| `/subtask <goal>` | Command that asks the current agent to spawn a bounded worker. |
| `subtask` | Creates the worker session and returns a structured summary. |
| `read_session` | Lets that worker read its source session when needed. |

See [Subtask](subtask.md).

## Patch rescue

`not-my-opencode` can repair some stale `apply_patch` inputs before OpenCode's
native patch tool runs. It stays conservative: no ambiguous rewrites, no edits
outside the allowed root/worktree, and no changes to unrelated tool inputs.

## Formatters

OpenCode runs built-in formatters after file writes/edits when configured for the
language. See the
[OpenCode formatter docs](https://opencode.ai/docs/formatters/#built-in).
