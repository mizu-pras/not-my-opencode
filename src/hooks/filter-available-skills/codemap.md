# src/hooks/filter-available-skills/

## Responsibility

- Filter `<available_skills>` blocks in outgoing prompt text so the model only
  sees skills allowed for the active agent.

## Design

- `createFilterAvailableSkillsHook(_ctx, config)` implements
  `experimental.chat.messages.transform`.
- Agent permission maps are memoized in a per-hook `Map`.
- `getCurrentAgent(messages)` walks backward to the latest user message and
  defaults to `orchestrator`.
- `filterAvailableSkillsText(text, permissionRules)` regex-parses
  `<available_skills>` / `<skill>` blocks and keeps only exact-allow or
  wildcard-allow entries.
- `ask` permissions are hidden here; only `allow` survives prompt exposure.

## Flow

1. Determine the active agent from the latest user turn.
2. Resolve or reuse cached permission rules from config overrides + CLI skill
   policy helpers.
3. Rewrite each `<available_skills>` block in matching text parts to keep only
   allowed `<skill>` entries.
4. If nothing remains, replace the block with `No skills available.`.
5. Mutate `part.text` in place.

## Integration

- Wired through `src/hooks/index.ts` and plugin hook registration.
- Runs just before the model call, so UI-visible messages stay unchanged while
  prompt-exposed capabilities are reduced.
