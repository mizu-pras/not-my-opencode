# src/interview/

## Responsibility

- Implement `/interview` command interception plus live interview state management.
- Keep session state, markdown spec files, and browser UI/dashboard state synchronized.
- Support both per-session local UI and shared dashboard mode.

## Main modules

- `manager.ts`: composition root and mode switch.
- `service.ts`: interview domain logic and session/event integration.
- `server.ts`: per-session HTTP UI.
- `dashboard.ts`: shared dashboard server, auth, cache, and recovery.
- `document.ts`: path/frontmatter/markdown rewrite helpers.
- `parser.ts`: `<interview_state>` extraction and fallback state generation.
- `prompts.ts`, `helpers.ts`, `types.ts`, `ui.ts`: prompt templates, HTTP helpers, schemas, and HTML renderers.

## Manager behavior

- `createInterviewManager(ctx, config)` enables dashboard mode when `interview.dashboard === true` or `interview.port > 0`; otherwise it runs a local per-session server on a random port.
- Dashboard mode tries `tryBecomeDashboard(...)` first:
  - winner keeps the HTTP dashboard, auth token file, in-process state cache, and file-scan recovery;
  - non-winners probe the dashboard, read the auth file, register their session directory over HTTP, and push state/interview creation back to the dashboard;
  - if the dashboard cannot be reached after retry, the process falls back to per-session server mode.
- A 10s fallback timer keeps polling for pending answers and nudge actions while running as a session client.

## Service behavior

- Tracks:
  - `activeInterviewIds` by session,
  - `interviewsById`,
  - `sessionBusy`,
  - last observed `sessionModel`,
  - browser-open and file-list caches.
- `handleCommandExecuteBefore(...)`:
  - registers `/interview` if needed;
  - blank args with no active interview inject a prompt asking for a one-line idea;
  - blank args with an active interview reopens the UI and instructs the agent to continue without duplicating unanswered questions;
  - existing slug/path resumes a markdown-backed interview;
  - otherwise creates a new interview file and injects the kickoff prompt.
- `syncInterview(...)`:
  - loads session messages after `baseMessageCount`;
  - filters out plugin-internal text parts marked with `SLIM_INTERNAL_INITIATOR_MARKER`;
  - extracts the latest valid assistant `<interview_state>` block;
  - falls back to file summary + inferred state when parsing fails or no block exists;
  - optionally renames the markdown file to the assistant-provided title;
  - rewrites the markdown spec and emits dashboard state updates.
- `submitAnswers(...)` and `handleNudgeAction(...)`:
  - enforce not-found/abandoned/busy guards;
  - set the busy lock before async work to avoid duplicate submissions;
  - append answers to markdown or build continuation/finalization prompts;
  - use `session.promptAsync(...)` with the last seen session model when available.
- `handleEvent(...)`:
  - `session.status` updates busy flags;
  - `message.updated` captures `providerID/modelID` for later `promptAsync` reuse;
  - `session.deleted` marks the active interview abandoned and clears per-session maps.

## Dashboard behavior

- Auth token is stored at `${XDG_DATA_HOME || ~/.local/share}/opencode/.dashboard-<port>.json` and validated by cookie, query token, or bearer token.
- Maintains:
  - registered sessions/directories,
  - `stateCache` by interview ID,
  - consume-on-read pending answers,
  - consume-on-read nudge actions,
  - manual/discovered scan folders.
- Rebuilds disconnected interview entries from markdown frontmatter as `recovered-*` records and removes stale recovered entries once a live interview with the same slug appears.
- Scans known output folders for resumable `.md` files and trims terminal cache entries after 24h.

## HTTP surfaces

- `server.ts` exposes `GET /`, `GET /api/interviews`, `GET /interview/:id`, `GET /api/interviews/:id/state`, `POST /api/interviews/:id/answers`, and `POST /api/interviews/:id/nudge`.
- Error mapping distinguishes not found, busy/conflict, malformed payload, invalid question state, and generic server failures.

## Integration

- Wired from `src/index.ts` via command hooks and session/message lifecycle events.
- Depends on OpenCode session APIs for messages, prompt injection, async prompting, and status updates.
