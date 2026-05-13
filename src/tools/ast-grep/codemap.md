# src/tools/ast-grep/

## Responsibility

Wraps the external `sg` CLI behind stable OpenCode tools and bootstrap helpers.

- `ast_grep_search`: AST-aware pattern search.
- `ast_grep_replace`: AST-aware rewrite with preview-by-default semantics.
- CLI bootstrap helpers for binary discovery, environment checks, and on-demand download.

## Files

- `tools.ts`: public tool schemas/descriptions and metadata emission.
- `cli.ts`: command assembly, process spawning, timeout/error handling, JSON parsing.
- `types.ts`: 25-language enum plus match/result shapes.
- `utils.ts`: result formatting and empty-result hints.
- `constants.ts`: binary lookup paths and environment diagnostics.
- `downloader.ts`: fallback GitHub-release download/extract/cache path.
- `index.ts`: barrel re-export used by the plugin layer.

## Flow

1. `ast_grep_search` or `ast_grep_replace` validates arguments through OpenCode tool schemas.
2. `tools.ts` forwards normalized args to `runSg(...)`.
3. `cli.ts` resolves the `sg` binary through cached discovery, installed package paths, Homebrew paths, or downloader fallback.
4. `runSg(...)` spawns `sg`, enforces timeout/output limits, and parses compact JSON into `SgResult`.
5. `utils.ts` formats matches/replacements for display and `tools.ts` mirrors that output through tool metadata when available.

## Design

- **Lazy singleton init:** binary discovery/download work is shared across concurrent calls.
- **Thin tool wrappers:** all heavy behavior stays in `cli.ts`, keeping tool definitions declarative.
- **Preview-first replace:** `dryRun !== false` maps to non-mutating output unless the caller explicitly opts into writes.
- **Language-aware UX hints:** empty results can append AST-pattern guidance without changing CLI behavior.

## Integration

- Re-exported from `src/tools/index.ts` and registered in `src/index.ts` as public tools.
- `index.ts` also exposes `ensureCliAvailable`, `getAstGrepPath`, `checkEnvironment`, and downloader helpers for setup or diagnostics.
