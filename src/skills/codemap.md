# src/skills/

## Responsibility

Holds bundled OpenCode skill payloads copied into the user's skills directory at install time.

- `codemap`: repository mapping and codemap state workflow.
- `clonedeps`: orchestrator workflow for cloning read-only dependency source into `.slim/clonedeps/repos/`.
- `simplify`: oracle-oriented behavior-preserving simplification guidance.

These folders are static prompt assets, not runtime TypeScript modules.

## Registry

`src/cli/custom-skills.ts` is the source-of-truth manifest:

- `codemap` → `allowedAgents: ['orchestrator']`
- `clonedeps` → `allowedAgents: ['orchestrator']`
- `simplify` → `allowedAgents: ['oracle']`

Each entry maps `name`, human description, and `sourcePath` for installer copy.

## Install flow

1. `src/cli/install.ts` iterates `CUSTOM_SKILLS`.
2. `installCustomSkill()` resolves the package root, validates the source folder, and recursively copies it into `${configDir}/skills/<name>`.
3. OpenCode later reads each installed `SKILL.md` as the executable prompt contract.

## Packaging and permissions

- `src/cli/skills.ts` derives default skill permissions from `CUSTOM_SKILLS` so bundled skills can be auto-allowed for the intended agents.
- `src/hooks/filter-available-skills/` enforces those permissions at runtime.
- Release verification checks that bundled `SKILL.md` payloads remain present in the published package.
