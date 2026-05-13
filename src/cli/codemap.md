# CLI Module Codemap

## Responsibility

`src/cli/` owns installer/doctor commands plus config-file mutation and generated
config/skill helpers used during installation.

- parse CLI subcommands and flags
- validate local OpenCode installation and config state
- mutate OpenCode main/TUI/plugin config files atomically
- generate the initial `not-my-opencode.json` preset-based config
- install external skills and copy bundled skills

## Command surface (`index.ts`)

- `install [--skills=yes|no] [--preset=<name>] [--no-tui] [--dry-run] [--reset]`
- `doctor [--json]`
- `--help` for top-level usage

`--no-tui` now only disables interactive prompts (`promptForStar`); it does not
disable TUI config handling.

## Installer flow (`install.ts`)

`install(args)` builds `InstallConfig` then `runInstall(config)` performs:

1. detect existing installation state via `detectCurrentConfig()`
2. optionally verify OpenCode binary/version/path
3. add the plugin to OpenCode main config
4. add the plugin to OpenCode TUI config (version badge path)
5. warm OpenCode package cache for package-manager installs
6. disable OpenCode default `explore` / `general` agents
7. enable `lsp: true` by default when unset
8. write or preview generated `not-my-opencode.json`
9. optionally install recommended skills and bundled custom skills

## Doctor flow (`doctor.ts`)

- parses `--json` and `--help`
- checks user and project plugin config files discovered by
  `config/loader.findPluginConfigPaths()`
- parses JSONC with `stripJsonComments()` and validates with
  `PluginConfigSchema`
- merges valid user/project configs with `mergePluginConfigs()` to verify the
  selected preset exists (including env override behavior)
- returns either human-readable diagnostics or JSON and exits nonzero on any
  invalid config or missing preset

## Config generation and IO

- `providers.ts`
  - defines preset model mappings (`openai`, `kimi`, `copilot`, `zai-plan`,
    `opencode-go`)
  - `generateLiteConfig()` always emits generated presets for `openai` and
    `opencode-go`; `--preset` only chooses which generated preset is active
  - injects per-agent model, variant, skills, and default MCP lists
  - ensures `designer` gets `agent-browser`
- `config-io.ts`
  - JSON/JSONC parsing helpers
  - atomic writes with `.tmp` + `.bak`
  - plugin registration for both OpenCode config and TUI config
  - default-agent disabling, `lsp` enablement, cache warm-up
- `paths.ts`
  - resolves `OPENCODE_CONFIG_DIR`, XDG/default config dirs, and
    `OPENCODE_TUI_CONFIG`
  - provides search order used by both installer and runtime loader

## Skills

- `skills.ts`
  - recommended installable skills (`npx skills add ...`)
  - permission-only skills that affect agent permissions but are not installed
  - `getSkillPermissionsForAgent()` shared by runtime agent registration
- `custom-skills.ts`
  - bundled skill registry (`simplify`, `codemap`, `clonedeps`)
  - recursive copy into OpenCode's skills directory during install

## Files

- `index.ts` — CLI dispatch and top-level help
- `install.ts` — installer orchestration and console UX
- `doctor.ts` — config diagnostics command
- `providers.ts` — preset/model mapping and generated config
- `config-io.ts` — config parsing/writing/mutation helpers
- `paths.ts` — config path resolution
- `skills.ts`, `custom-skills.ts` — skill registries and installation helpers
- `system.ts` — OpenCode binary/version checks
- `types.ts` — install/config DTOs
- `config-manager.ts` — CLI helper barrel
