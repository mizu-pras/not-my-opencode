# src/tools/smartfetch/

## Responsibility

Implements the public `webfetch` tool.

- Fetches remote pages/documents with redirect and origin controls.
- Prefers `llms.txt` / `llms-full.txt` for docs-like URLs when configured.
- Renders text, markdown, or html output with optional metadata.
- Handles binary responses, optional binary persistence, caching, and optional secondary-model summarization.

## Files

- `tool.ts`: end-to-end orchestration and tool schema.
- `network.ts`: URL normalization, permission patterns, redirects, probing, fetch/decode helpers.
- `cache.ts`: in-memory cache, stale reuse, revalidation helpers, llms-result invalidation.
- `utils.ts`: content extraction, cleanup, heading/frontmatter rendering, message shaping.
- `binary.ts`: binary file persistence and result messages.
- `secondary-model.ts`: bounded helper-session summarization/extraction.
- `constants.ts`, `types.ts`, `index.ts`: shared surface and export barrel.

## Flow

1. `createWebfetchTool` validates args and asks for `webfetch` permission using normalized URL-derived patterns.
2. A cache key is built from URL plus fetch-shaping options (`extract_main`, `prefer_llms_txt`, `save_binary`).
3. For docs-like requests, the tool may probe `/llms-full.txt` then `/llms.txt`; successful probe results bypass page fetch.
4. Otherwise `fetchWithUpgradeFallback(...)` performs bounded fetch, HTTPS upgrade fallback, redirect validation, and conditional revalidation.
5. Text/HTML responses are decoded, cleaned, optionally main-content extracted, and rendered with optional frontmatter metadata; binary responses either persist to disk or return metadata-only output depending on size/options.
6. If `prompt` is supplied and secondary models are available, a tool-free helper session processes bounded fetched content; failures fall back to the base fetch output.

## Design

- **Single orchestration entrypoint:** `tool.ts` owns policy, caching, rendering, and secondary-model decisions.
- **Fetch-shape cache:** render format is derived late, so `text`/`markdown`/`html` reuse the same fetched payload.
- **Graceful degradation:** invalid `llms.txt`, blocked redirects, oversized binaries, or summarizer failures still yield usable output.
- **Bounded I/O:** explicit timeout, redirect count, response size, llms probe timeout, and secondary-model input caps prevent runaway fetches.

## Integration

- Re-exported from `src/tools/index.ts` and registered in `src/index.ts` as the always-available `webfetch` tool.
- `WEBFETCH_DESCRIPTION` in `constants.ts` is the canonical user-facing tool description.
- Shared types (`FetchResult`, `CachedFetch`, `BinaryFetch`, `SmartfetchOptions`) are exported for tests and higher-level docs.
