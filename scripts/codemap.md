# scripts/

## Responsibility

- Maintain the small repo-owned build/release script surface: schema generation plus publish-time artifact/host smoke checks.
- Generate derived artifacts from source-of-truth config types and verify packaged outputs remain portable and host-loadable.
- Provide non-interactive gates that catch leaked local paths, missing published files, and plugin load failures before release.

## Design

- `generate-schema.ts`
  - Imports `PluginConfigSchema` from `src/config/schema.ts` and emits canonical JSON Schema via `z.toJSONSchema`.
  - Writes `not-my-opencode.schema.json` with explicit `$schema`, `title`, and package-level description.
- `verify-release-artifact.ts`
  - Uses `spawnSync` + `npm pack --json --ignore-scripts`.
  - Scans `dist/**/*` for leaked machine paths (`/Users/*`, `/home/*`).
  - Validates required packaged files including runtime entrypoints, schema, README/license, and shipped skill payloads.
  - Performs clean-install smoke by importing the installed `dist/index.js` default export in a temp project.
- `verify-opencode-host-smoke.ts`
  - Packs the current repo, installs `opencode-ai` into an isolated temp host, mounts the plugin tarball via XDG config,
    launches `opencode serve`, and probes `http://127.0.0.1:<port>/global/health`.
  - Captures logs and fails on `failed to load plugin` and `cannot find module` patterns.
- All scripts are executable boundary files (`#!/usr/bin/env bun` / Node), with explicit temp-dir lifecycle management
  and defensive cleanup via `rmSync(..., { force: true, recursive: true })`.

## Flow

- `bun run build` invokes `scripts/generate-schema.ts` through `package.json#generate-schema` after type declaration generation.
- `bun run verify:release` runs `verify-release-artifact.ts`: scan built output -> pack artifact -> validate packaged file set -> install/import check.
- `bun run verify:host-smoke` runs `verify-opencode-host-smoke.ts`: pack tarball -> boot isolated OpenCode host -> wait for health -> inspect logs for load failures.
- Both verification scripts are non-interactive and designed for CI/CD pre-publish gates.

## Integration

- Bound to `package.json` scripts for local dev and release pipelines.
- Release verification depends on build outputs from `bun run build:plugin` and `bun run build:cli` because it expects
  published `dist/` entrypoints plus generated schema to already exist.
- Package integrity expectations are mirrored by tests and release scripts that assert packaged skill metadata and
  runtime files are present.
- Smoke checks instantiate the same main plugin entrypoint (`dist/index.js`) that `src/index.ts` exports, catching runtime breakage before publishing.
