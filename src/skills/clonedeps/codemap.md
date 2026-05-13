# src/skills/clonedeps/

## Responsibility

Bundled orchestrator workflow for making dependency source locally readable without turning the skill into a package-manager-specific script.

- Delegates dependency/source-repo discovery to `@librarian`.
- Requires orchestrator-owned ref verification and user approval.
- Stores reusable clone metadata in `.slim/clonedeps.json`.
- Keeps cloned repositories under `.slim/clonedeps/repos/` as ignored, read-only inspection material.

## Files

- `SKILL.md`: full workflow contract, including verify/clone/state/update/cleanup steps.
- `README.md`: concise operator summary of the same workflow.

## Workflow model

- No helper script is bundled; repo-specific judgment stays in librarian/orchestrator prompts.
- Existing manifest entries must be reused before planning fresh clones.
- Safe clone paths are derived from repository owner/name (for example `opencode-ai__opencode`).
- Shared monorepos are cloned once, with per-package `packagePath` recorded in the manifest when needed.

## Managed state

- Trackable metadata: `.slim/clonedeps.json`
- Ignored clone contents: `.slim/clonedeps/repos/<safe-name>/`
- Managed marker blocks:
  - `.gitignore` ignores clone contents,
  - `.ignore` re-allows cloned sources for OpenCode while still hiding nested `.git/`,
  - root `AGENTS.md` gains a `## Cloned Dependency Source` section listing each clone and why it exists.

## Integration

- Registered in `src/cli/custom-skills.ts` as orchestrator-only bundled skill `clonedeps`.
- Installed by the custom-skill copy flow in `src/cli/install.ts`.
- Included in release verification alongside other bundled `SKILL.md` assets.
