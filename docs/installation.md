# Installation

## Install

```bash
bunx not-my-opencode@latest install
```

Non-interactive:

```bash
bunx not-my-opencode@latest install --no-tui --skills=yes
```

Use the OpenCode Go preset:

```bash
bunx not-my-opencode@latest install --preset=opencode-go
```

## Options

| Option | Meaning |
|---|---|
| `--skills=yes|no` | Install recommended and bundled skills. Default: `yes`. |
| `--preset=<name>` | Active generated preset: `openai` or `opencode-go`. |
| `--no-tui` | Non-interactive mode. |
| `--dry-run` | Show planned changes without writing files. |
| `--reset` | Overwrite existing plugin config after making a backup. |

## What the installer writes

- Adds this plugin to `~/.config/opencode/opencode.json`.
- Attempts to add the companion TUI entry to `~/.config/opencode/tui.json`.
- Writes `~/.config/opencode/not-my-opencode.json` unless it already exists.
- Installs skills when `--skills=yes`.
- Enables OpenCode LSP integration when no explicit `lsp` setting exists.
- Warms OpenCode's plugin cache for `bunx` installs.

Existing `not-my-opencode.json` files are preserved by default. Use `--reset` to
replace them; a `.bak` file is created first.

## After install

```bash
opencode auth login
opencode models --refresh
opencode
```

Then verify inside OpenCode:

```text
ping all agents
```

Edit models and permissions in:

```text
~/.config/opencode/not-my-opencode.json
```

## For coding agents

Use this prompt:

```text
Install and configure not-my-opencode from:
https://raw.githubusercontent.com/mizu-pras/not-my-opencode/refs/heads/master/README.md
```

Do not run `opencode auth login` for the user; it is interactive.

## Troubleshooting

Check the installer help:

```bash
bunx not-my-opencode@latest install --help
```

Run diagnostics from a project root:

```bash
bunx not-my-opencode@latest doctor
```

Check auth:

```bash
opencode auth status
```

For tmux/zellij panes, start OpenCode with a port:

```bash
tmux
export OPENCODE_PORT=4096
opencode --port 4096
```

## Schema

Add this to config files for editor validation:

```jsonc
{
  "$schema": "https://unpkg.com/not-my-opencode@latest/not-my-opencode.schema.json"
}
```

## Uninstall

1. Remove `not-my-opencode` from the `plugin` array in:
   - `~/.config/opencode/opencode.json`
   - `~/.config/opencode/tui.json`
2. Remove config files if desired:

   ```bash
   rm -f ~/.config/opencode/not-my-opencode.json
   rm -f ~/.config/opencode/not-my-opencode.json.bak
   ```

3. Remove installed skills if desired:

   ```bash
   npx skills remove agent-browser
   rm -rf ~/.config/opencode/skills/simplify
   rm -rf ~/.config/opencode/skills/codemap
   rm -rf ~/.config/opencode/skills/clonedeps
   ```
