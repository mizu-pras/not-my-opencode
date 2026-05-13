# src/skills/codemap/

## Responsibility

Bundled orchestrator skill for repository mapping and incremental codemap maintenance.

- `SKILL.md`: workflow contract for init/change-detection/fixer delegation.
- `README.md`: concise operator docs and CLI examples.
- `scripts/codemap.mjs`: local state management and codemap scaffold generator.

## State model

- Primary state file: `.slim/codemap.json`
- Legacy input accepted: `.slim/cartography.json` (migrated forward)
- Stored data:
  - `metadata` (`version`, `last_run`, include/exclude patterns)
  - `file_hashes`
  - `folder_hashes`

## Script surface

`scripts/codemap.mjs` exposes three command paths:

- `init`: select files, hash them, write state, create empty `codemap.md` placeholders per discovered folder.
- `changes`: compare current hashes to saved state and report added/removed/modified files plus affected folders.
- `update`: recompute hashes using existing metadata after folder codemaps are refreshed.

Tests in `scripts/codemap.test.ts` cover hashing, file selection, and legacy-state migration.

## Workflow contract

- The skill tells the orchestrator to check existing codemap state first.
- Initial runs create the state file and empty folder codemaps.
- Incremental runs update only folders reported by `changes`.
- After folder-level updates, the orchestrator refreshes the root `codemap.md` atlas and ensures `AGENTS.md` points future agents at the codemap.

## Integration

- Registered in `src/cli/custom-skills.ts` as bundled orchestrator-only skill `codemap`.
- Installed by `src/cli/install.ts`; OpenCode executes the copied `scripts/codemap.mjs` from the user skill directory.
- Runtime visibility is filtered through bundled-skill permission rules.
