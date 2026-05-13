# apply-patch

## Responsibility

Provide a resilient `tool.execute.before` preflight for `apply_patch` that
rewrites recoverable stale hunks, normalizes patch paths, verifies prepared file
state, and blocks unsafe patches before native execution.

## Design

- Entry point: `createApplyPatchHook` in `index.ts`.
- Main pipeline: `rewritePatch` in `rewrite.ts` (re-exported from
  `operations.ts`).
- Core support modules:
  - `execution-context.ts`: strict parse, path guarding, relative-path
    normalization, prepared file snapshots, add/move/update/delete checks.
  - `codec.ts`: patch parse/format/normalization helpers.
  - `resolution.ts`: chunk resolution plus rewritten content derivation.
  - `matching.ts`: bounded `prefixSuffix` and `lcsRescue` stale-hunk rescue.
  - `errors.ts`: `ApplyPatchError` taxonomy (`blocked`, `validation`,
    `verification`, `internal`).
- Rewrite may merge dependent hunks for one file or collapse them into a
  canonical whole-file update hunk when that is the safest replay form.
- Rescue behavior is fixed by `APPLY_PATCH_RESCUE_OPTIONS` with both
  `prefixSuffix` and `lcsRescue` enabled.

## Flow

1. Run only for `input.tool === 'apply_patch'` with string `args.patchText`.
2. Resolve `root` plus optional `worktree` from hook context.
3. `rewritePatch(...)` parses, validates, path-normalizes, verifies prepared
   filesystem state, and rewrites stale-but-safe update hunks.
4. If the patch changed, replace `output.args.patchText` with canonical text.
5. If args are readonly, log `skipped` and fail open.
6. If the plugin-side path guard raises `outside_workspace`, log `skipped` and
   fail open so native OpenCode validation remains authoritative.
7. All other `blocked`, `validation`, `verification`, and `internal` errors are
   logged and rethrown to stop native execution.

## Integration

- Wired through `src/index.ts` on `tool.execute.before`.
- Uses `utils/logger` for `rewrite`, `unchanged`, `skipped`, `blocked`,
  `validation`, `verification`, and `internal` telemetry.
- Keeps `new_lines` byte-preserving while only changing anchors, path form, and
  canonical hunk layout needed for safe replay.
