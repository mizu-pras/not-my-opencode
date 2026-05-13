# src/hooks/auto-update-checker/

## Responsibility

- Provide a one-shot startup hook that checks whether the installed
  `not-my-opencode` package is behind its configured channel and optionally
  refreshes the active install with `bun install`.
- Distinguish local-dev `file://` installs, pinned versions/tags, unpinned
  `latest`, and legacy cache installs.

## Design

- `createAutoUpdateCheckerHook(ctx, options)` registers an `event` handler for
  root `session.created` only and gates execution with `hasChecked`.
- Startup work is deferred with `setTimeout(..., 0)`.
- `runBackgroundUpdateCheck` handles discovery, channel/version comparison,
  notification-only branches, and prepared reinstall flow.
- `checker.ts` resolves config entries, local-dev paths, runtime package
  version, dist-tag/channel mapping, and latest registry version.
- `cache.ts` resolves the active install root, updates `package.json`
  dependency spec, removes stale installed package artifacts, and optionally
  edits JSON `bun.lock` files.
- `runBunInstallSafe` is a 60s best-effort wrapper around
  `crossSpawn(['bun', 'install'])`.

## Flow

1. On the first eligible root `session.created`, queue a background check.
2. If the plugin is loaded from a local `file://` config entry, log local-dev
   mode and stop.
3. Resolve the active plugin config entry plus current installed version
   (`getCachedVersion()` first, then pinned spec fallback).
4. Infer the update channel from the pinned/current version and fetch the latest
   version for that channel from npm.
5. If already current, stop silently.
6. If newer version exists:
   - pinned entry ⇒ info toast only,
   - `autoUpdate=false` ⇒ info toast only,
   - otherwise prepare install context, run `bun install`, and report
     success/failure by toast.

## Integration

- Wired through `src/hooks/index.ts` and plugin startup as an `event` hook.
- Uses `ctx.client.tui.showToast`, Node `fs/path/url`, npm-registry `fetch`,
  and `crossSpawn`.
- Export surface includes `getAutoUpdateInstallDir()` plus
  `AutoUpdateCheckerOptions` for tests/host overrides.
