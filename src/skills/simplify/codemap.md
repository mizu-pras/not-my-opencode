# src/skills/simplify/

## Responsibility

Bundled oracle skill for behavior-preserving simplification and readability-focused refactoring.

- Encodes when simplification is appropriate.
- Forces understand-before-edit and verify-after-edit discipline.
- Constrains work to local, low-risk cleanups rather than feature changes.

## Files

- `SKILL.md`: executable prompt contract.
- `README.md`: provenance and install note.

## Contract shape

`SKILL.md` defines:

- usage criteria and anti-patterns,
- five principles (`Preserve Behavior Exactly`, `Follow Project Conventions`, `Prefer Clarity Over Cleverness`, `Maintain Balance`, `Scope to What Changed`),
- a phased process (`understand`, `identify candidates`, `apply incrementally`, `verify`),
- a repository-specific verification checklist.

There is no helper script or persistent state in this folder.

## Integration

- Registered in `src/cli/custom-skills.ts` as `simplify` with `allowedAgents: ['oracle']`.
- Installed by the custom-skill copy flow in `src/cli/install.ts`.
- Runtime visibility is filtered by bundled-skill permission rules and `src/hooks/filter-available-skills/`.
